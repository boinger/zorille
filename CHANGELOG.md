# Changelog

## Unreleased

## [1.10.0] - 2026-04-09

### Added

- **`/deps` skill** for dependency audit, update, and CVE remediation across
  Go, Python, Swift, Dart/Flutter, C#/.NET, and Node.js. Risk-tiered updates
  (critical → security → patch → minor) with test verification; never auto-
  bumps majors without explicit approval. Subcommands: `audit` (default —
  scan for outdated deps and CVEs), `update`, `cve`, `triage`. Originally
  lived as a personal slash command at `~/.claude/commands/deps.md`;
  consolidated into zorille so the codebase-hygiene toolkit lives in one
  repo. Pure-markdown skill with no `lib/` integration, no internal tests
  beyond `test/deps-validation.test.ts` for frontmatter typo protection,
  and no `deps/VERSION` file (the prompt has no release cadence). Tagline,
  README, `package.json` description, GitHub repo description, and the
  setup banner all updated from "two skills" to "three skills" framing.

### Fixes

- **`./setup` no longer creates stray self-symlinks on re-run.** `setup:48` and
  `action.yml:111` both used `ln -sf SRC DST`. When DST already exists as a
  symlink to a directory (true on every run after the first), both BSD and GNU
  `ln` follow the symlink and create a new link INSIDE the target directory,
  named `basename(SRC)`. That's why repeat runs of `./setup` were leaving
  `plan-fixes/plan-fixes` and `<repo-basename>/<repo-basename>` strays in the
  working tree. Replaced with `ln -sfn` at both call sites — the `-n` flag
  tells `ln` not to dereference a symlink-to-directory destination. Adds
  `test/setup-symlink.test.ts` regression test that runs `./setup` twice in
  an isolated `HOME` and asserts both the absence of strays and the presence
  of the correct install symlinks. The prior fix (`669c92e`) removed only the
  symptom file, which is why the bug came back — this test codifies the
  invariant.
- **`action.yml` hardened against script injection and fail-open.** Every
  `${{ inputs.X }}` reference inside a `run:` block was template-substituted
  before bash saw the script, making shell quoting impossible. Refactored
  every affected step to bind inputs to env vars and reference them as bash
  variables (the canonical fix per GitHub's own security hardening guide).
  Added a `Validate inputs` step that case-checks `fail-on`, `format`, and
  `min-severity` at the action boundary. Replaced the `|| true` fail-open in
  the audit step with explicit exit code capture; removed the `// "pass"` jq
  fallbacks in the parse step that previously made a missing result file
  silently report as a clean audit. Pinned `actions/cache@v4` →
  `0057852b...` (v4.3.0), `github/codeql-action/upload-sarif@v3` →
  `3b1a19a8...` (v3.35.1), and three `actions/checkout@v4` references in
  `self-test.yml` → `34e11487...` (v4.3.1) to commit SHAs.

### Changed

- Renamed repo `codebase-audit` → `zorille`. The `/codebase-audit` slash command
  itself is **unchanged** — its name, install path, env vars, and baseline home
  (`~/.codebase-audits/`) all remain the same. Only the GitHub repo, local clone
  directory, package.json name, and README title change. Solo-dev project, no
  known downstream consumers — the rename is a cosmetic reorganization of the
  container brand, not a behavioral change. If any downstream consumers exist,
  GitHub will redirect the old URL automatically; explicit
  `git remote set-url origin git@github.com:boinger/zorille.git` is the safer
  update.
- Self-audit baseline seam: `lib/slug.sh` now derives `boinger-zorille` for
  self-audits instead of `boinger-codebase-audit`. Old baselines at
  `~/.codebase-audits/codebase-audit/` are orphaned — they remain readable but
  new runs write to `~/.codebase-audits/boinger-zorille/`. Same seam as the
  v1.9.2 rename-free baseline notes; no backfill.
- README refactored: cut from ~200 lines to ~95, single-audience narrative
  (what / why / install / use / configure / one-paragraph CI pointer / upgrade
  / license). CI / GitHub Action material extracted to a new `CI.md` covering
  the quick start, SARIF + Code Scanning, baseline onboarding, PR-scoped
  check, notes, and full inputs/outputs reference. `package.json` and the
  GitHub repo description were updated alongside the README to reflect both
  skills (and now three skills, after the `/deps` addition above).

## [1.9.2] - 2026-04-08

### Fixes

- **Shared-script path resolution (Phase 1 preamble).** v1.9.0 and v1.9.1 invoked the shared helper scripts `lib/slug.sh` and `lib/probe-exists.sh` via `$REPO_ROOT/lib/<script>.sh`, where `$REPO_ROOT` comes from `git rev-parse --show-toplevel` — i.e., the git root of the **audit target**, not the skill's install directory. For every audit target that wasn't the codebase-audit repo itself, neither script was reachable:
  - `lib/slug.sh` silently fell back to `basename "$REPO_ROOT"`, producing non-canonical slugs (e.g., `pr-owl` instead of `boinger-pr-owl`). Baselines were written under the basename slug at `$AUDIT_HOME/<basename>/` and `/plan-fixes` auto-discovery stayed in sync by making the same fallback. **Broken since v1.9.0.**
  - `lib/probe-exists.sh` had no built-in fallback. The LLM defensively hedged with inline `|| ls <guessed files>` fallbacks in Phase 1.2, which happened to work when the guesses panned out and cascade-cancelled when they didn't. **Broken since v1.9.1.**

  Root cause was architectural, not script-level: `lib/slug.sh` and `lib/probe-exists.sh` themselves are correct and unchanged in v1.9.2. The bug was exclusively in how the SKILL.md preambles referenced them.

  Fix introduces `LIB_DIR` in both SKILL.md preambles, defaulted to `$HOME/.claude/skills/codebase-audit/lib` (the standard `./setup` install path) with an env var override via `CODEBASE_AUDIT_LIB_DIR`. All script invocations now go through `$LIB_DIR`, not `$REPO_ROOT`. Both skills share the same `$LIB_DIR` default (the shared lib lives in the codebase-audit install; `/plan-fixes` references it via the same path).

- **Stale-symlink warning.** The preamble now emits a one-line stderr warning if `$LIB_DIR` doesn't exist (e.g., deleted dev clone, broken symlink, misconfigured env var). `[ -d "$LIB_DIR" ] || echo "WARNING: ..." >&2`. Cheap insurance — makes misconfiguration diagnosable at first glance instead of surfacing as mysterious downstream Phase 1.2 failures. Especially matters in v1.9.2 because the new "fail loudly on probe-exists.sh" design removes the LLM's defensive fallback.

### Why this wasn't caught sooner

This is worth documenting explicitly so future maintenance passes don't repeat the pattern:

- **The existing contract tests bypassed the broken preamble entirely.** `test/slug-contract.test.ts` and `test/probe-exists-contract.test.ts` invoke the scripts via absolute paths (`path.join(ROOT, "lib", "slug.sh")`), verifying the scripts work in isolation. They never exercised the SKILL.md preamble's lookup path — where the bug actually lived. Passing contract tests gave false confidence that the whole chain worked.

- **Self-hosted testing masked the bug.** During v1.9.0 and v1.9.1 development, every test run against the codebase-audit repo itself worked because `$REPO_ROOT` happens to equal the skill install directory in that specific case. The bug only became visible when a user ran `/codebase-audit` against a project that wasn't codebase-audit.

- **The cross-ref assertions grepped for script names, not invocation paths.** Tests like "both SKILL.md files invoke lib/slug.sh identically" matched the substring `"lib/slug.sh"` without validating the `$REPO_ROOT` prefix. They would have passed just fine even if the prefix was `$REPO_ROOT`, `$LIB_DIR`, or `$NONSENSE_VARIABLE`.

### New test class: `test/preamble-contract.test.ts`

This release adds a new behavioral test that closes the testing gap above. The test extracts the preamble bash block from each SKILL.md by content anchor (finding the fence that starts with `LIB_DIR=`), executes it against a temp directory that is NOT the codebase-audit repo, and asserts the shared scripts actually resolve and run. It catches the exact class of bug that escaped v1.9.0 and v1.9.1.

**If you're considering deleting `test/preamble-contract.test.ts` because it seems to overlap with `test/slug-contract.test.ts` or `test/probe-exists-contract.test.ts`, don't.** Those tests verify the scripts work when invoked via absolute path. This test verifies the SKILL.md preamble can find and invoke them the way the LLM will at runtime. They are testing different things:

| Test | What it exercises | What it catches |
|---|---|---|
| `slug-contract.test.ts` | `lib/slug.sh` invoked via absolute path against fixture repos | Script-level bugs in slug derivation logic |
| `probe-exists-contract.test.ts` | `lib/probe-exists.sh` invoked via absolute path against fixture files | Script-level bugs in probe logic |
| `preamble-contract.test.ts` (NEW) | The full SKILL.md preamble bash block executed from a non-codebase-audit repo with `CODEBASE_AUDIT_LIB_DIR` plumbing | **Preamble-level bugs** in how the skill references its shared scripts (exactly the v1.9.0/v1.9.1 class of bug) |

All three are load-bearing and complementary.

### Tests

- +4 structural assertions in `test/skill-validation.test.ts` (both codebase-audit and plan-fixes SKILL.md files): `LIB_DIR` presence with `CODEBASE_AUDIT_LIB_DIR` env var fallback, stale-symlink warning presence
- +7 behavioral tests in the new `test/preamble-contract.test.ts`: bash block extraction from both SKILL.md files, end-to-end execution against a fake fixture repo, canonical slug resolution, probe-exists.sh chained invocation via `$LIB_DIR`, stale-symlink warning firing, env var override working
- Existing cross-ref assertions in `test/slug-contract.test.ts`, `test/probe-exists-contract.test.ts`, and `test/skill-validation.test.ts` tightened to match the `$LIB_DIR/` form instead of the old `$REPO_ROOT/lib/` form (net 0 assertion count change; same greps, narrower patterns)

Test count: 236 → 247 (+11). All passing.

### Upgrade notes

- **Existing baselines at wrong slug paths are not backfilled.** If you have audit history at `~/.codebase-audits/<basename>/` (e.g., `~/.codebase-audits/give-back/` instead of the canonical `~/.codebase-audits/<owner-repo>/`), those baselines stay where they are. v1.9.2 writes to the canonical slug path going forward, which means the first post-v1.9.2 audit of any previously-audited project starts a fresh regression baseline. If you care about regression continuity, either copy your old baselines to the new path manually or accept the seam.
- **No migration required for users who haven't run any external audits.** If you've only ever run `/codebase-audit` against the codebase-audit repo itself (self-audit), the slug resolved correctly under v1.9.0/v1.9.1 by coincidence and v1.9.2 produces the same slug. Nothing to do.

## [1.9.1] - 2026-04-08

### Fixes

- **Baseline JSON hash computation (Phase 4.4).** The v1.9.0 pattern (`echo -n ... | shasum` inline inside a heredoc) had a silent-corruption bug: if the heredoc used `<<'EOF'` (single-quoted, which is the correct choice for suppressing accidental expansion of `$SLUG` etc. in the body), the inline substitution also got suppressed and the baseline was written with literal `$(echo -n ... | shasum)` strings in the `id` fields instead of computed SHA-256 hashes. Regression comparison then silently broke on the next audit run — every finding appeared "new" because the ids didn't match.

  Fixed by switching to a **placeholder + sed** pattern: compute hashes into shell variables first, write the heredoc with `__HASH_N__` placeholder tokens (single-quoted so nothing expands), then `sed -i.bak -e "s|__HASH_N__|$HN|g"` to substitute them in. Zero expansion surface inside the heredoc means finding titles containing literal `$` (e.g., `"Missing $PATH validation"`) are safe by construction. Includes a tool fallback (`shasum` → `sha256sum`) and a post-sed integrity guard that fails loudly if any `__HASH_N__` placeholder remains unreplaced.

- **Sentinel file probing (Phase 1.2 + Key Rule 2d).** v1.9.0 documented a probe pattern (`for f in ...; do [ -e "$f" ] && echo "$f"; done`) and promoted Key Rule 2d to enforce it, but the LLM still wrote `ls -la /absolute/path/... /Dockerfile /.github/workflows 2>/dev/null` in live audits, cascade-cancelling sibling parallel tool calls when any probed file was missing. Root cause: inline code blocks get paraphrased; named scripts get copied verbatim.

  Fixed by extracting the probe pattern into `lib/probe-exists.sh` as a shared script (parallels the existing `lib/slug.sh` v1.9.0 pattern). The SKILL.md preamble now includes a comment block referencing both helper scripts, and Phase 1.2 leads with the literal `bash "$REPO_ROOT/lib/probe-exists.sh" <files>...` invocation as its first code block. Rule 2d is updated to forbid `ls` for probing and point at the script. Belt-and-suspenders placement (preamble + Phase 1.2) addresses the transmission failure the v1.9.0 inline approach hit.

### Tests

- New slice-scoped structural assertions in `test/skill-validation.test.ts` for Phase 4.4 (5 assertions) and Phase 1.2 (3 assertions including a `ls -la` regression guard scoped to the Phase 1.2 section slice only, so legitimate `ls -la` elsewhere in SKILL.md can't trip the guard).
- New `test/probe-exists-contract.test.ts` (mirror of `test/slug-contract.test.ts`): 10 tests covering script metadata, behavioral fixtures (happy path / no files / mixed / spaces / directories / broken symlinks / zero args), and the cross-SKILL.md grep contract.
- New `test/phase44-hash-behavior.test.ts`: 5 tests that actually execute the Phase 4.4 pattern against fixture findings (including one with a literal `$PATH` in the title), parse the resulting baseline, assert every `finding.id` matches `/^[a-f0-9]{64}$/`, and verify hashes are deterministic across repeated runs. Catches regression even if the SKILL.md prose rewrites around the structural assertions.

Test count: 218 → 236 (+18 new assertions across 3 test files). All passing.

## [1.9.0] - 2026-04-07

### Architecture

- **`--plan-fixes` extracted into a sibling skill `/plan-fixes`.** The depth-aware grouping, investigation, and planning logic that shipped in v1.8.0 as Phase 4.7 sub-steps now lives in its own skill at `plan-fixes/` in this repo. The setup script installs both skills. **The `/codebase-audit --plan-fixes` flag is preserved as a thin alias** — it runs the audit, then invokes `/plan-fixes` against the resulting baseline. Backward compatible. No migration needed for existing users. See `plan-fixes/CHANGELOG.md` for the 0.1.0 release notes.
- **New Phase 5.5: Baseline rewrite.** When `--quick-fix` runs, Phase 5.5 rewrites the baseline with `quick_fix_status` per finding (`"applied"`, `"skipped"`, or unset) after fixes are applied. This is the correctness fix that makes `--plan-fixes --quick-fix` composable via the alias dispatch — `/plan-fixes` now reads an accurate post-application baseline and annotates already-applied groups via its Option D coordination.
- **`lib/slug.sh` shared contract.** Slug derivation (`git remote get-url origin` → `owner-repo`) moved from inline `SKILL.md` logic into a shared shell script at the repo root. Both `/codebase-audit` and `/plan-fixes` invoke it, enforced by `test/slug-contract.test.ts`. This prevents slug drift between the two skills — a load-bearing contract because `/plan-fixes`'s baseline auto-discovery depends on computing the same slug as the audit that wrote the baseline.

### New: `/plan-fixes` sibling skill (v0.1.0)

- Standalone planner that consumes `/codebase-audit` baseline.json *or* any SARIF 2.1.0 source (CodeQL, ESLint, Semgrep, Sonar, GitHub Code Scanning, etc.).
- Option D quick-fix coordination: three plan template variants (`plan-standard.md`, `plan-mixed.md`, `plan-applied.md`) annotate groups based on `quick_fix_status` — plans are a canonical record, never a filtered subset.
- Security hardening for SARIF input: 7-step path validation (URI scheme strip, URL decode, `..` rejection, absolute-path suffix matching, symlink guard) and LLM injection mitigation (500-char truncation, markdown escape, `<untrusted-input>` tag wrapping).
- Flags: `--from`, `--baseline`, `--sarif`, `--thorough`, `--show-applied`, `--verbose`.
- Compression stat at Phase 7: "Compressed M findings into N reviewable plans" — the magical moment for SARIF consumers.
- See `plan-fixes/SKILL.md` and `plan-fixes/CHANGELOG.md` for full details.

### Why

Auditing and planning are conceptually independent operations. v1.8.0 wedged planning into Phase 4.7 of the audit pipeline as a conditional fork; v1.9.0 cleans that up by giving planning its own skill. The `baseline.json` schema becomes the documented contract between them. Future siblings (verifiers, auto-fixers) can land without recoupling. v1.9.0 is **non-BREAKING** because the `--plan-fixes` flag continues to work via the alias dispatch.

## [1.8.0] - 2026-04-06

### Features

- **Plan-fixes mode** (`--plan-fixes`): Transforms audit findings into grouped, review-ready fix plan files with an LLM-native depth dial. Mechanical findings get grouped plans. Substantive findings get deeper investigation (callers, tests, adjacent code) after consent.
  - **Depth investigation**: Traces callers via grep (prefers fully-qualified names, guards against common names), searches tests via 5-pattern priority list, reads containing function via bracket/indentation detection
  - **Grouping heuristic**: Same file or same pattern + top-level dir, max 8 findings / 5 files per group, "Part N of M" overflow, monorepo degeneracy guard (60% rule)
  - **Risk rubric**: Explicit criteria for High/Medium/Low based on callers, tests, and blast radius
  - **`--thorough`**: Auto-dive on all substantive findings without consent prompt
  - **Plans written to** `$AUDIT_HOME/$SLUG/plans/{datetime}-{N}-{slug}.md`
  - **Plan menu**: Act on all / Select by number / Skip
  - **Composes with `--quick-fix`**: Plans generated first, mechanical fixes applied in Phase 5, affected plans marked `[AUTO-APPLIED]` in Phase 4.7.7
  - **Dependencies tracking**: File-overlap heuristic via running file-set tracker

## [1.7.0] - 2026-04-06

### Features

- **GitHub Action** (`uses: boinger/zorille@v1`): One-line CI integration. Composite action wraps Claude Code skill invocation with:
  - All CI flags exposed as action inputs (fail-on, format, changed-only, baseline-only, fail-on-new, etc.)
  - File-based output parsing (reads from `$AUDIT_HOME`, not stdout) for reliability
  - Automatic SARIF upload to GitHub Code Scanning when `format: sarif`
  - Baseline persistence via `actions/cache` for regression tracking across runs
  - Smoke check validates skill installation before running
  - Job-level isolation via `$GITHUB_RUN_ID`
  - Fork PR guard documented in examples
  - Self-test workflow via `workflow_dispatch`

## [1.6.0] - 2026-04-06

### Features

- **Baseline-only mode** (`--ci --baseline-only`): Establish a baseline for future regression tracking without failing CI. Runs the full audit, writes baseline, always passes (exit 0). For CI onboarding on legacy codebases.
  - Mutually exclusive with `--fail-on-new` and `--fail-on-regression`
  - Adds `metadata.baseline_only: true` to JSON output so consumers can distinguish baseline-mode passes
  - First-run tip suggests `--baseline-only` when no previous baseline exists

## [1.5.0] - 2026-04-06

### Features

- **Infrastructure scanning** (automatic): Auto-detects Dockerfiles, K8s manifests, Terraform, GitHub Actions, docker-compose, and nginx configs. Scans with 16 high-signal grep patterns when infra files are present. Use `--no-infra` to opt out.
  - Docker: unpinned base images, running as root, secrets in build args, ADD vs COPY
  - Kubernetes: privileged containers, host networking
  - Terraform: overly permissive IAM, public S3 buckets, hardcoded credentials
  - CI/CD: unpinned actions, pull_request_target injection, secrets in run blocks
  - Docker Compose: privileged mode, unbound ports
  - nginx: server tokens, weak TLS
- Infrastructure findings compete on severity with app findings for the 50-finding cap
- K8s detection covers `k8s/`, `deploy/` directories and Helm `Chart.yaml`

## [1.4.0] - 2026-04-06

### Features

- **SARIF output** (`--format sarif`): SARIF 2.1.0 output for GitHub Code Scanning and compatible static analysis tools. Rule IDs are human-readable (`category/kebab-title`). Severity maps to SARIF levels with `security-severity` scores.
  - Composes with `--ci` (replaces JSON, same exit codes), `--changed-only`, `--min-severity`, `--quick`
  - Written to `$AUDIT_HOME/$SLUG/audits/{dt}-results.sarif` and stdout
  - Upload with `github/codeql-action/upload-sarif@v3`
  - `message.text` = title only (clean inline annotations); `rule.fullDescription.text` = recommendation (click-through detail)
  - Invalid `--format` values produce a clear error with supported formats listed

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
