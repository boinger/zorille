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

## License

MIT
