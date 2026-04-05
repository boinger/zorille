# Changelog

## [1.3.0] - 2026-04-04

### Features

- **CI mode** (`--ci`): Machine-readable JSON output for CI/CD pipelines. Exit code 0 (pass) or 1 (fail) based on configurable threshold. All interactive prompts suppressed.
  - `--fail-on critical` (default) or `--fail-on important`
  - `--fail-on-regression`: also fail if health score decreased
  - `--fail-on-new`: fail only on new findings (not in previous baseline)
  - Composes with `--changed-only` and `--quick`
  - JSON also written to `$AUDIT_HOME/$SLUG/audits/{dt}-ci-output.json`
- **JSON mode** (`--json`): Structured JSON output without CI exit-code behavior. For dashboards and scripts.
- **Severity filter** (`--min-severity <level>`): Filter output to findings at or above a severity threshold (critical, important, notable). Does not affect health score.
- CI JSON built from baseline.json for schema consistency
- JSON includes `schema_version`, `tool_version`, `duration_seconds`, `findings_count`, invocation `flags` and `ignored_flags`

## [1.2.0] - 2026-04-03

### Features

- **Changed-only mode** (`--changed-only [ref]`): Scopes audit to files changed since a git ref. Default: merge base of current branch against default branch. Override with explicit ref (`HEAD~5`, `main`, etc.).
- Skips Phase 2 (architecture scan) and baseline generation for scoped audits
- Pragmatic Grep threshold: ≤20 files individually, >20 files via full codebase scan with result filtering
- Handles binary files (silently skipped) and renamed files (new name only)
- Consolidated tips block in conversation summary for all mode nudges

## [1.1.0] - 2026-04-03

### Features

- **Quick fix mode** (`--quick-fix`): Auto-applies mechanical `[HIGH CONFIDENCE]` fixes after the audit (Phase 5). Eligibility: single file, <10 lines changed, not vendored/generated. Stages changes and proposes commit message for user approval.
- Implies `--suggest-fixes` automatically
- Dirty working tree detection with proceed/abort prompt
- Same-file conflict handling with fresh re-reads between fixes

## [1.0.0] - 2026-04-03

Initial standalone release. Zero external dependencies.

### Features

- **Full audit mode**: 4-phase pipeline (orientation, architecture scan, targeted deep dives, report generation) producing structured reports with health scores and actionable recommendations
- **Quick mode** (`--quick`): 2-minute smoke check with project profile, health score, and top 5 findings
- **Suggest fixes** (`--suggest-fixes`): Inline unified diffs for mechanical fixes, tagged by confidence level
- **Regression tracking**: Automatic baseline comparison on repeat runs, showing fixed/new/persistent findings and score delta
- **Custom checklists**: Drop `.codebase-audit/checklist.md` in your project for project-specific audit patterns
- **Configurable storage**: Reports saved to `~/.codebase-audits/` by default, override with `CODEBASE_AUDIT_HOME`
- **Dependency vulnerability scanning**: Auto-detects package manager and runs appropriate audit tool
- **Git churn analysis**: Hotspot files, bus factor estimation
