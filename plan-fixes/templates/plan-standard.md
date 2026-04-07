# Fix Plan: {group title}

## Context
{Why this group exists — the finding(s) and their impact.}

## Findings
| # | Severity | Title | File | Line |
|---|----------|-------|------|------|
{table of findings in this group}

*(If input was multi-tool SARIF, add a Tool column sourced from each finding's `source_tool` field. Omit the column when all findings share the same tool.)*

## Approach

*(For shallow plans — all mechanical or investigation not performed — use a single narrative or per-finding one-line approach.)*

*(For deep plans — investigated findings — use one `### Finding N: {title}` sub-section per investigated finding:)*

### Finding 1: {title}
{Investigation notes: callers (grep-based; flag incompleteness), tests (which patterns matched and coverage gaps), context (containing function or fallback window), recommended fix.}

### Finding 2: {title}
{...}

*(For un-investigated findings in a partially-investigated group:)*

### Finding N: {title}
{One-line approach. Note: "Investigation deferred due to session cap."}

## Files to Modify
- {file}: {what changes}

## Risk
**{Low|Medium|High}** — {rubric-based justification}

Rubric:
- **High**: 3+ callers affected OR test coverage gap for the affected path OR multi-file change
- **Medium**: single file with tests present but finding is non-trivial
- **Low**: isolated change with clear, passing tests

## Verify & Rollback
- Run: {test command}
- Check: {grep pattern or manual verification}
- Rollback: `git revert <commit-hash>` after applying, or revert specific file changes

## Dependencies
{Other fix plans (by number) that touch files this plan modifies, e.g., "Plan #3 also modifies src/auth.ts"}
{If none: "None detected."}
