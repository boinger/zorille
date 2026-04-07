# codebase-audit repo

This repo hosts **two related Claude Code skills**:

- `/codebase-audit` — cold-start codebase audit (top-level `SKILL.md`)
- `/plan-fixes` — findings-to-fix-plans translator (sibling skill at `plan-fixes/SKILL.md`)

Both are skill definitions (markdown + tests), not running applications. The setup script installs both via symlink loop.

## Key Files

### /codebase-audit
- `SKILL.md` — Skill entry point. Defines the 4-phase audit pipeline (+ Phase 5 `--quick-fix`, + Phase 5.5 baseline rewrite). Primary development surface.
- `checklist.md` — Audit patterns with ripgrep-friendly regex. Each pattern has a severity and explanation.
- `references/patterns.md` — Supplemental language-specific anti-patterns.
- `report-template.md` — Output structure for audit reports.
- `VERSION` — Repo + /codebase-audit skill version. Referenced by setup script and SKILL.md frontmatter.

### /plan-fixes (sibling skill)
- `plan-fixes/SKILL.md` — 7-phase plan generation skill. Reads baseline.json or SARIF 2.1.0.
- `plan-fixes/templates/plan-{standard,mixed,applied}.md` — three plan file templates for Option D group classification.
- `plan-fixes/VERSION` — Independent skill version (starts at 0.1.0).
- `plan-fixes/CHANGELOG.md` — Per-skill changelog.

### Shared infrastructure
- `lib/slug.sh` — **Load-bearing contract.** Canonical slug derivation shared by both skills. Both SKILL.md files invoke `bash "$REPO_ROOT/lib/slug.sh"`. Drift between the skills here breaks `/plan-fixes`'s baseline auto-discovery. Enforced by `test/slug-contract.test.ts`.
- `setup` — Install script. Creates symlinks for BOTH skills via a per-skill loop (no early exit — existing v1.8.0 users upgrading via `./setup` get the new `/plan-fixes` symlink automatically).
- `CHANGELOG.md` — Top-level changelog covering /codebase-audit releases.

## Development

```bash
bun test                    # Run all tests (6 files: codebase-audit + plan-fixes + slug contract)
bun run test:evals          # Run only e2e eval tests (requires EVALS=1)
./setup                     # Install/update both skill symlinks (idempotent)
```

**Test discovery:** `bun test` from the repo root recursively discovers `**/*.test.ts`, so it finds tests in both `test/` and `plan-fixes/test/` without any `package.json scripts.test` changes. The `tsconfig.json` `include` array covers both directories for TypeScript checking.

## Constraints

- /codebase-audit is read-only during audit phases 1-3. Only writes reports and baselines to `$AUDIT_HOME` (default `~/.codebase-audits/`). Phase 5 (`--quick-fix` only) applies mechanical fixes to source code. Phase 5.5 rewrites the baseline with `quick_fix_status` after Phase 5.
- /plan-fixes is read-only for source code. Only writes plan files to `$AUDIT_HOME/$SLUG/plans/`.
- Checklist patterns must be valid ripgrep regex (not GNU grep).
- Keep each SKILL.md self-contained — Claude reads each as a single document.
- Changes to SKILL.md frontmatter (`version`, `name`, `allowed-tools`) affect skill discovery and behavior.
- **Never inline slug derivation** in either SKILL.md. Always invoke `lib/slug.sh` via the preamble pattern. The slug contract test will fail if either SKILL.md drifts.
- When modifying `lib/slug.sh`, re-run `bun test test/slug-contract.test.ts` against the fixture URLs.
