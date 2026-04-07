# Fix Plan: {group title}

## Context
{Why this group exists — the finding(s) and their impact. Note that some findings in this group were already auto-applied by `/codebase-audit --quick-fix`; the Status column in the Findings table below marks which.}

## Findings
| # | Severity | Title | File | Line | Status |
|---|----------|-------|------|------|--------|
{table of findings in this group — Status column shows `applied` or `pending` per row}

*(If input was multi-tool SARIF, add a Tool column sourced from each finding's `source_tool` field. Omit the column when all findings share the same tool.)*

## Approach

*(Status column above marks which findings are already auto-applied. This Approach section addresses only the **pending** findings — the applied ones are done and require no further action unless you want to review or roll them back.)*

*(For shallow pending findings:)*
{Single narrative or per-finding one-line approach for pending findings only.}

*(For deep pending findings — investigated:)*

### Finding N: {title} *(pending)*
{Investigation notes: callers, tests, context, recommended fix. Only for pending findings.}

*(Do not include `### Finding N` sub-sections for findings whose Status is `applied` — those are already done.)*

## Files to Modify
*(Only list files touched by pending findings. Files already modified by `--quick-fix` should not be re-modified unless part of a substantive finding's fix.)*
- {file}: {what changes for pending findings}

## Risk
**{Low|Medium|High}** — {rubric-based justification for the remaining pending work}

Rubric:
- **High**: 3+ callers affected OR test coverage gap for the affected path OR multi-file change
- **Medium**: single file with tests present but finding is non-trivial
- **Low**: isolated change with clear, passing tests

## Verify & Rollback
- Run: {test command}
- Check: {grep pattern or manual verification} — include both the applied fixes and the new pending ones
- Rollback: `git revert <commit-hash>` after applying, or revert specific file changes. To roll back the already-applied findings separately, see the git log for `--quick-fix` commits.

## Dependencies
{Other fix plans (by number) that touch files this plan modifies, e.g., "Plan #3 also modifies src/auth.ts"}
{If none: "None detected."}
