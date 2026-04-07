# /codebase-audit

A [Claude Code](https://claude.ai/code) skill that performs cold-start codebase audits. Drop into any project and get a structured report covering bugs, security issues, architectural problems, tech debt, test gaps, and improvement opportunities. Read-only ... never modifies your code.

## Install

```bash
git clone https://github.com/boinger/codebase-audit ~/.claude/skills/codebase-audit
```

Or clone anywhere and run setup:

```bash
git clone https://github.com/boinger/codebase-audit ~/Projects/codebase-audit
cd ~/Projects/codebase-audit
./setup
```

## Usage

```
/codebase-audit                    # Full audit (10-30 min depending on codebase size)
/codebase-audit --quick            # 2-minute smoke check
/codebase-audit --suggest-fixes    # Full audit with inline fix diffs per finding
```

## Modes

- **Full** (default): All 4 phases. Health score, architecture diagram, findings by severity, fix plan.
- **Quick** (`--quick`): Phase 1 only + top 10 checklist patterns. Project profile, health score, top 5 findings. Under 2 minutes.
- **Regression** (automatic): If a previous baseline exists, diffs against it. Shows what's fixed, what's new, score delta.
- **Suggest Fixes** (`--suggest-fixes`): Adds a unified diff to each finding where a mechanical fix is possible. Diffs are tagged `[HIGH CONFIDENCE]` or `[REVIEW SUGGESTED]`.

## Custom Checklists

Drop a `.codebase-audit/checklist.md` in your project root to add project-specific audit patterns. These run after the built-in patterns. Use the same format as the built-in `checklist.md`.

## Storage

Audit reports and regression baselines are saved to `~/.codebase-audits/<project>/audits/`.

To change the storage location, set the `CODEBASE_AUDIT_HOME` environment variable:

```bash
export CODEBASE_AUDIT_HOME="$HOME/.local/share/codebase-audits"
```

## Upgrade

```bash
cd ~/.claude/skills/codebase-audit && git pull
```

Or if you used the setup script:

```bash
cd ~/Projects/codebase-audit && ./setup
```

## CI / GitHub Action

Run codebase audits automatically in CI with one line:

```yaml
- uses: boinger/codebase-audit@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### SARIF + GitHub Code Scanning

Findings appear inline on PRs in GitHub's Security tab:

```yaml
permissions:
  security-events: write
  contents: read

steps:
  - uses: actions/checkout@v4
  - uses: boinger/codebase-audit@v1
    with:
      anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
      format: sarif
      fail-on: important
```

### CI Onboarding (baseline first run)

Establish a baseline without failing CI, then gate on regressions:

```yaml
# Day 1: establish baseline
- uses: boinger/codebase-audit@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    baseline-only: true

# Day 2+: fail only on new findings
- uses: boinger/codebase-audit@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    fail-on-new: true
```

### PR-scoped check

Audit only changed files, fail on new findings:

```yaml
on:
  pull_request:

jobs:
  audit:
    # Skip for fork PRs (no access to secrets)
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # needed for changed-only merge base
      - uses: boinger/codebase-audit@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          changed-only: true
          fail-on-new: true
```

### Notes

- **Platform**: Requires `ubuntu-latest` runner
- **Cost**: Max plan users have no incremental cost. API key users: ~$2-10 per full audit; use `changed-only: true` for PR checks to reduce usage
- **Data**: Code context is sent to the Anthropic API for analysis
- **Baselines**: Persisted via `actions/cache`, subject to 7-day eviction on inactive repos. Set `cache-baseline: false` to disable
- **Permissions**: `security-events: write` required for SARIF upload to GitHub Code Scanning
- **`fetch-depth: 0`**: Required when using `changed-only: true` so git can compute the merge base
- **Fork PRs**: Forked PRs cannot access repository secrets. Guard with `if: github.event.pull_request.head.repo.full_name == github.repository`

### All Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `anthropic-api-key` | (required) | Anthropic API key |
| `fail-on` | `critical` | Threshold: `critical` or `important` |
| `format` | `json` | Output: `json` or `sarif` |
| `changed-only` | `false` | Scope to changed files |
| `baseline-only` | `false` | Establish baseline, always pass |
| `fail-on-new` | `false` | Fail only on new findings |
| `fail-on-regression` | `false` | Fail if score regressed |
| `min-severity` | | Filter: `critical`, `important`, `notable` |
| `no-infra` | `false` | Skip infrastructure scanning |
| `upload-sarif` | `true` | Auto-upload SARIF |
| `sarif-category` | `codebase-audit` | SARIF upload category |
| `cache-baseline` | `true` | Persist baselines across runs |
| `claude-code-version` | `latest` | Pin Claude Code CLI version |
| `extra-flags` | | Additional flags for /codebase-audit |

### Outputs

| Output | Description |
|--------|-------------|
| `status` | `pass` or `fail` |
| `health-score` | 0-100 |
| `findings-count` | Number of findings |
| `sarif-file` | Path to SARIF file (when format=sarif) |

## License

MIT
