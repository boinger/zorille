# zorille repo

This repo hosts **four related Claude Code skills** for working with
codebases you don't know — your own or someone else's:

- `/codebase-audit` — cold-start codebase audit (top-level `SKILL.md`)
- `/plan-fixes` — findings-to-fix-plans translator (sibling skill at `plan-fixes/SKILL.md`)
- `/deps` — dependency audit and risk-tiered updates (sibling skill at `deps/SKILL.md`)
- `/issue-forensics` — upstream-contribution investigation playbook (sibling skill at `issue-forensics/SKILL.md`)

All four are skill definitions (markdown + tests), not running applications. The setup script installs all four via symlink loop.

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

### /deps (sibling skill)
- `deps/SKILL.md` — Dependency-hygiene skill. Subcommands: `audit`, `update`, `cve`, `triage`. Pure-markdown, no `lib/` integration, no per-skill VERSION file.

### /issue-forensics (sibling skill)
- `issue-forensics/SKILL.md` — Upstream-contribution investigation playbook. 4-question entry gate (Q1 hard gate) + 5-pillar playbook + quick-report exit template + structured draft template.
- `issue-forensics/references/loki-21524.md` — Embedded gold-standard exemplar with provenance header. Lazy-loaded by the skill prompt only when trigger conditions fire.
- `issue-forensics/VERSION` — Independent skill version (starts at 0.1.0).
- `issue-forensics/CHANGELOG.md` — Per-skill changelog.

### Shared infrastructure
- `lib/slug.sh` — **Load-bearing contract.** Canonical slug derivation shared by `/codebase-audit`, `/plan-fixes`, and `/issue-forensics`. All invoke `bash "$LIB_DIR/slug.sh"` in their preamble. Drift between the skills here breaks `/plan-fixes`'s baseline auto-discovery. `/issue-forensics` additionally uses the optional-argument mode (`bash slug.sh <url|path>`) to derive slugs for investigation targets that aren't cwd. Enforced by `test/slug-contract.test.ts`.
- `setup` — Install script. Creates symlinks for ALL skills via a per-skill loop driven by the `SKILLS=(...)` array (line 5). Adding a skill requires editing that array, not restructuring the loop. No early exit — existing users get the new symlinks on re-run.
- `CHANGELOG.md` — Top-level changelog covering /codebase-audit releases and repo-level changes (README, setup, shared infra).

## Development

```bash
bun test                    # Run all tests — discovers **/*.test.ts recursively
bun run test:evals          # Run only e2e eval tests (requires EVALS=1)
./setup                     # Install/update all skill symlinks (idempotent)
```

**Test discovery:** `bun test` from the repo root recursively discovers `**/*.test.ts`, so it finds tests in `test/`, `plan-fixes/test/`, and `issue-forensics/test/` without any `package.json scripts.test` changes. The `tsconfig.json` `include` array covers all three directories for TypeScript checking. `/deps` has no test dir (pure prompt skill, no structural assertions beyond what `test/deps-validation.test.ts` covers at the top level).

## Constraints

- /codebase-audit is read-only during audit phases 1-3. Only writes reports and baselines to `$AUDIT_HOME` (default `~/.codebase-audits/`). Phase 5 (`--quick-fix` only) applies mechanical fixes to source code. Phase 5.5 rewrites the baseline with `quick_fix_status` after Phase 5.
- /plan-fixes is read-only for source code. Only writes plan files to `$AUDIT_HOME/$SLUG/plans/`.
- /deps runs language-native package managers via Bash — modifies lockfiles and dependency manifests only, never source code. Test verification gates every update.
- /issue-forensics is read-only for source code (both cwd and target repo). Only writes `.notes.md` and `.draft.md` files to `$ISSUE_FORENSICS_HOME/$SLUG/` (default `~/.issue-forensics/`). Never writes into the target repo's working tree.
- Checklist patterns must be valid ripgrep regex (not GNU grep).
- Keep each SKILL.md self-contained — Claude reads each as a single document.
- Changes to SKILL.md frontmatter (`version`, `name`, `allowed-tools`) affect skill discovery and behavior.
- **Never inline slug derivation** in any SKILL.md. Always invoke `lib/slug.sh` via the preamble pattern. The slug contract test will fail if any SKILL.md drifts.
- When modifying `lib/slug.sh`, re-run `bun test test/slug-contract.test.ts` against the fixture URLs (both zero-argument mode and URL/path-argument mode).
