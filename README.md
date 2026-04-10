# zorille

Three Claude Code skills for finding what's wrong in a codebase and fixing it: bugs, fix plans, and dependency hygiene.

## Three skills, one repo

- **`/codebase-audit`** finds problems. Cold-start audit of any codebase: bugs, security issues, architectural problems, tech debt, test gaps. Writes a structured report and a `baseline.json` for regression tracking. Read-only by default; opt in to mechanical fixes with `--quick-fix`.
- **`/plan-fixes`** turns problems into fix plans. Reads the baseline `/codebase-audit` writes — or any SARIF 2.1.0 source (CodeQL, ESLint, Semgrep, Sonar, GitHub Code Scanning). Groups findings into PR-sized plans with depth-aware investigation: callers, tests, and adjacent context.
- **`/deps`** handles dependency hygiene. Audit, update, and CVE remediation across Go, Python, Swift, Dart/Flutter, C#/.NET, and Node.js. Risk-tiered updates (critical → security → patch → minor) with test verification; never auto-bumps majors without approval. Standalone — doesn't depend on the audit/plan-fixes flow.

The slash commands are `/codebase-audit`, `/plan-fixes`, and `/deps` regardless of where you cloned the repo. (For the story behind the repo name, see the bottom of this file.)

## What this solves

You inherited a codebase you don't know. You need to know what's in there before you start changing it — what's broken, what's risky, what's tech debt, what's a security problem. `/codebase-audit` reads the code cold and produces a structured report you can act on. Run it again later and it tells you what's fixed, what's new, and where the score moved.

`/plan-fixes` is the bridge from "I have a list of findings" to "I have a PR-sized plan I can hand to a coding agent." It works against `/codebase-audit`'s output, but it also reads SARIF from any external scanner — so existing CodeQL or Semgrep results can become reviewable fix plans without re-scanning.

And `/deps` covers the dependency-hygiene layer of "what's wrong" — outdated packages, known CVEs, deprecated libraries — across the major language ecosystems, with risk-tiered updates that won't silently bump a major version on you.

## What a fix plan looks like

`/plan-fixes` compresses raw findings into reviewable, PR-sized plans:

```
Compressed 217 CodeQL findings into 14 reviewable plans (avg 15.5 findings per plan).
  Action needed: 9 plans (3 high-risk, 4 medium, 2 low)
  Already applied: 5 plans (auto-fixed by /codebase-audit --quick-fix)
  Sources: codeql: 217 findings
```

Each plan is a markdown file with Context, a Findings table, per-finding Approach (caller analysis, test coverage gaps, contextual notes), Files to Modify, Risk assessment, Verify & Rollback steps, and cross-plan Dependencies.

## Install

```bash
git clone https://github.com/boinger/zorille ~/Projects/zorille
cd ~/Projects/zorille
./setup
```

After `./setup`, both `/codebase-audit` and `/plan-fixes` are available as slash commands in Claude Code. The setup script is idempotent — re-run it to upgrade.

## Usage

```
/codebase-audit                           Full audit (10-30 min depending on codebase size)
/codebase-audit --quick                   2-minute smoke check
/codebase-audit --suggest-fixes           Full audit with inline fix diffs per finding
/codebase-audit --quick-fix               Audit + auto-apply mechanical fixes
/codebase-audit --plan-fixes [--thorough] Audit + dispatch to /plan-fixes (alias)
/plan-fixes                               Plan from latest baseline (auto-discovers)
/plan-fixes --from baseline.json          Plan from explicit baseline file
/plan-fixes --from results.sarif          Plan from any SARIF 2.1.0 source
/plan-fixes --sarif results.sarif         Same, explicit format
/plan-fixes --thorough                    Auto-investigate all substantive findings
/plan-fixes --show-applied                Expand already-applied plans in the menu
/deps                                     Audit dependencies (default subcommand)
/deps update                              Apply non-major updates with test verification
/deps cve                                 Apply security fixes only
/deps triage                              Prioritize open Dependabot/Renovate PRs
```

Audit modes: **Full** (default — all 4 phases, full report). **Quick** (`--quick` — phase 1 only + top 10 patterns, ~2 min). **Regression** (automatic — diffs against the previous baseline if one exists). **Suggest fixes** (`--suggest-fixes` — adds inline diffs to each finding). **Quick fix** (`--quick-fix` — auto-applies high-confidence mechanical fixes).

## Configuration

**Audit storage.** Reports and baselines are saved to `~/.codebase-audits/<project>/audits/`. Override the location with `CODEBASE_AUDIT_HOME`:

```bash
export CODEBASE_AUDIT_HOME="$HOME/.local/share/codebase-audits"
```

**Custom checklist patterns.** Drop a `.codebase-audit/checklist.md` in your project root to add project-specific audit rules. Custom patterns run after the built-in ones, in the same format as the built-in `checklist.md` in this repo.

## Use in CI

zorille is also a published GitHub Action. The simplest case:

```yaml
- uses: boinger/zorille@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

For SARIF output (fed to GitHub Code Scanning), baseline-first onboarding for legacy codebases, PR-scoped checks via `changed-only`, and the full inputs/outputs reference, see [CI.md](CI.md).

## Upgrade

```bash
cd ~/Projects/zorille && ./setup
```

Idempotent — works for fresh installs and upgrades.

## About the repo name

`zorille` is the alternate French spelling of *zorilla* — the African striped polecat (*Ictonyx striatus*), a small carnivore in family Mustelidae. The mustelids are stoats, martens, weasels, polecats, otters, badgers, ferrets: curious, smart little animals.

I felt like being named after a mustelid fit the work — small, sharp-nosed creatures that find things hidden under rocks, which is roughly what `/codebase-audit`, `/plan-fixes`, and `/deps` do for a codebase you don't yet know. And I picked "zorille" specifically (not the more common English "zorilla") because there weren't any other projects named that.

A literal name like `code-tools` or `audit-suite` would have been boring. The skills inside have those descriptive names because that's what skills need; the repo gets to have personality.

## License

MIT
