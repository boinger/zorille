# Changelog

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
