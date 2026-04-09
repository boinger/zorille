# zorille in CI

`zorille` is a published GitHub Action: `boinger/zorille@v1`. It runs `/codebase-audit` and produces structured output (JSON or SARIF) that you can gate PRs on, upload to GitHub Code Scanning, or persist as a baseline for regression tracking.

For local Claude Code use, see the [README](README.md).

## Quick start

Add the action to a workflow file:

```yaml
- uses: boinger/zorille@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

By default this runs a full audit and fails the job on critical findings. See [All inputs](#all-inputs) below for everything that's configurable.

## SARIF + GitHub Code Scanning

Findings appear inline on PRs in GitHub's Security tab when you upload SARIF:

```yaml
permissions:
  security-events: write
  contents: read

steps:
  - uses: actions/checkout@v4
  - uses: boinger/zorille@v1
    with:
      anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
      format: sarif
      fail-on: important
```

## Baseline onboarding (legacy codebases)

For an established codebase with existing tech debt, gating CI on the absolute finding count produces immediate noise. Establish a baseline first, then gate on regressions only:

```yaml
# Day 1: establish baseline
- uses: boinger/zorille@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    baseline-only: true

# Day 2+: fail only on new findings
- uses: boinger/zorille@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    fail-on-new: true
```

## PR-scoped check

Audit only files changed in the PR, fail on new findings, skip fork PRs (which can't access secrets):

```yaml
on:
  pull_request:

jobs:
  audit:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # required for merge-base computation
      - uses: boinger/zorille@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          changed-only: true
          fail-on-new: true
```

## Notes

- **Platform**: requires `ubuntu-latest` runner.
- **Cost**: Max plan users have no incremental cost. API key users: ~$2-10 per full audit; use `changed-only: true` for PR checks to reduce usage.
- **Data**: code context is sent to the Anthropic API for analysis.
- **Baselines**: persisted via `actions/cache`, subject to 7-day eviction on inactive repos. Set `cache-baseline: false` to disable.
- **Permissions**: `security-events: write` is required for SARIF upload to GitHub Code Scanning.
- **`fetch-depth: 0`**: required when using `changed-only: true` so git can compute the merge base.
- **Fork PRs**: forked PRs cannot access repository secrets. Guard with `if: github.event.pull_request.head.repo.full_name == github.repository`.

## All inputs

| Input | Default | Description |
|---|---|---|
| `anthropic-api-key` | (required) | Anthropic API key |
| `fail-on` | `critical` | Threshold: `critical` or `important` |
| `format` | `json` | Output format: `json` or `sarif` |
| `changed-only` | `false` | Scope audit to files changed in the PR/branch |
| `baseline-only` | `false` | Establish baseline, always pass (for onboarding) |
| `fail-on-new` | `false` | Fail only on findings new since last baseline |
| `fail-on-regression` | `false` | Also fail if health score regressed |
| `min-severity` | | Filter findings to this severity and above: `critical`, `important`, `notable` |
| `no-infra` | `false` | Skip infrastructure scanning |
| `upload-sarif` | `true` | Auto-upload SARIF to GitHub Code Scanning |
| `sarif-category` | `codebase-audit` | Category for SARIF upload (disambiguates multiple analysis tools) |
| `cache-baseline` | `true` | Persist baselines across runs via `actions/cache` |
| `claude-code-version` | `latest` | Pin the Claude Code CLI version |
| `extra-flags` | | Additional flags passed directly to `/codebase-audit` |

## Outputs

| Output | Description |
|---|---|
| `status` | `pass` or `fail` |
| `health-score` | Codebase health score (0-100) |
| `findings-count` | Number of findings |
| `sarif-file` | Path to the SARIF file (when `format=sarif`) |
