# Fix Plan: [ALREADY APPLIED] {group title}

## Context
{Why this group existed — the finding(s) and their original impact. All findings in this group were auto-applied by `/codebase-audit --quick-fix` — this plan file is written for the record, not as actionable work.}

## Findings
| # | Severity | Title | File | Line |
|---|----------|-------|------|------|
{table of findings in this group — all with quick_fix_status: "applied"}

*(If input was multi-tool SARIF, add a Tool column. Note: SARIF input never produces all-applied groups because SARIF has no `quick_fix_status` field. This template is reached only via baseline.json input from `/codebase-audit --quick-fix`.)*

## Status

All {N} findings in this group were auto-applied by `/codebase-audit --quick-fix` on {baseline.datetime}.

No further action needed unless the fixes need to be reviewed or rolled back.

**To review the applied fixes:** check the git log for commits from the `--quick-fix` run, typically with messages like `"fix: apply N quick-fix recommendations from codebase-audit"`.

**To roll back:** `git revert <commit-hash>` on the `--quick-fix` commit, or revert specific file changes.
