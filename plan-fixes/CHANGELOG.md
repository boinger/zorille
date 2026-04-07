# Changelog

## [0.1.0] - 2026-04-07

Initial release. Extracted from `/codebase-audit` v1.8.0's `--plan-fixes` flag into a standalone sibling skill.

### Features

- **Two input formats**: accepts `/codebase-audit` baseline.json or any SARIF 2.1.0 source (CodeQL, ESLint, Semgrep, Sonar, GitHub Code Scanning). Format auto-detected by content, or explicitly selected via `--baseline` / `--sarif`.
- **Depth-aware grouping**: same-file grouping, same-pattern + same-top-level-directory grouping, 60% monorepo degeneracy guard, 8-finding / 5-file group caps, "Part N of M" overflow, orphan singletons, sequential numbering.
- **Depth investigation** for substantive findings:
  - Caller analysis with fully-qualified name preference and 6-char + language-keyword bare-name guard
  - 5-pattern test file search (co-located `.test./.spec.`, `test_` prefix, `__tests__/`, `tests/`, `src/test/` mirror)
  - Function-boundary context detection via bracket matching or indentation
  - Capped at 10 findings per session
- **Risk rubric**: explicit High/Medium/Low criteria based on callers, test coverage, and blast radius.
- **Option D quick-fix coordination**: reads `quick_fix_status` from baseline.json and annotates groups via three template files:
  - `plan-standard.md` — pending groups (full Context/Approach/Files/Risk/Verify/Dependencies)
  - `plan-mixed.md` — groups with both applied and pending findings (Findings table gets a Status column)
  - `plan-applied.md` — all-applied groups (prefixed `[ALREADY APPLIED]`, includes Status section in place of Approach)
  - All findings end up in some plan file. Plans are a canonical record, never a filtered subset.
- **Two-section plan menu**: "Action needed" and "Already applied" (collapsed by default; `--show-applied` expands). `A) Act on all` / `B) Select by number` / `C) Skip`.
- **Compression stat**: Phase 7 prints "Generated N plans from M findings across K files" summary, and "Compressed M findings into N plans" for pure SARIF input.
- **File-overlap dependency tracking** via running file-set tracker across plan generation.
- **Security hardening for SARIF input**:
  - 7-step path validation (URI scheme strip, URL decode, lexical normalization, `..` rejection, repo-root resolve, absolute-path suffix matching for CI runners, symlink escape guard)
  - LLM injection mitigation (500-char truncation, control-character strip, markdown delimiter escape, `<untrusted-input>` tag wrapping in prompts)
  - Rejection counter with `--verbose` flag for full audit log
- **Slug derivation shared contract**: both `/plan-fixes` and `/codebase-audit` invoke `lib/slug.sh` at the repo root, enforced by `test/slug-contract.test.ts`.

### Flags

- `--from <path>` — explicit input path (auto-detects baseline.json vs SARIF 2.1.0)
- `--baseline <path>` — explicit baseline.json input (short-circuits format detection)
- `--sarif <path>` — explicit SARIF 2.1.0 input (short-circuits format detection)
- `--thorough` — auto-dive on all substantive findings without consent prompt
- `--show-applied` — expand the collapsed "Already applied" menu section
- `--verbose` — dump rejected findings from path validation to a log file

### Auto-discovery

When no input flag is given, `/plan-fixes` auto-discovers the most recent full baseline under `$AUDIT_HOME/$SLUG/audits/` and prints the path before proceeding. `--changed-only` baselines are filtered out (partial audit data would produce partial plans). SARIF input always requires explicit `--from` or `--sarif`.

### Relation to `/codebase-audit`

`/codebase-audit --plan-fixes` still works in v1.9.0+ as a thin alias that runs the audit, then dispatches to `/plan-fixes` against the resulting baseline. The `--thorough` flag forwards. For `--quick-fix + --plan-fixes`, the alias dispatch defers until after Phase 5 applies fixes and Phase 5.5 rewrites the baseline with `quick_fix_status`, so `/plan-fixes` sees the post-application state.
