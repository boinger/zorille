# Changelog

## [0.1.3] - 2026-04-27

### Changed

- **Pillar 5 grep discipline expanded** from 12 lines to per-language
  structural checklists (C/C++, Go, Python, TS/JS). Detail lives in
  the new lazy-loaded reference `references/pillar-5-grep-discipline.md`;
  SKILL.md keeps the two-phase framing (find vs reason about context),
  GATE ASSERTION, N/A rendering, and a one-line trigger pointing at
  the reference.
- **No behavior change visible to the user** — same skill, same flags,
  same output shape; the improvement is internal grep discipline
  applied during Pillar 5.

### Added

- **`references/pillar-5-grep-discipline.md`** — lazy-loaded reference
  with per-language structural-feature checklists (C/C++ anonymous
  namespaces, vtable dispatch, macro expansion, callback tables; Go
  interface satisfaction, package-qualified calls, method values;
  Python MRO, decorators, metaclass dispatch; TS/JS overload
  resolution, re-exports, default exports, dynamic imports); plus
  cross-cutting patterns (generated code, test fixtures); plus
  call-site context-reading framing (concurrency, lifetime, polarity,
  trust shape); plus tool escape hatches (scip-clang, scip-go,
  scip-typescript, scip-python, ast-grep, clangd) documented as
  explicit non-default escape hatches with documented usage criteria
  and scratchpad logging requirements.

### Context

Motivated by an investigation of graph-vs-grep for Pillar 5 caller
traces — see `references/decisions/2026-04-graph-investigation.md`.
The full corpus (3 investigations: 2 Prusa C++, 1 Loki Go) showed
grep with discipline was sufficient for every Pillar 5 trace. Tool
augmentations (scip-*, ast-grep, clangd) are documented as escape
hatches for future Type-B (structural / indirect) failures rather
than defaults. The graph-tool project was evaluated and rejected in
favor of this discipline expansion.

## [0.1.2] - 2026-04-15

### Added

- **Phase 5.5: disclosure-path check** for security-shaped findings.
  Conditional phase that fires only when `security_shaped: yes` after
  re-evaluation. Probes four disclosure surfaces in order: (1) GitHub
  security policy via community/profile API with SECURITY.md fallback
  and cached-URL 404 fallthrough; (2) GitHub private vulnerability
  reporting via `security/advisories/new` UI-scrape (NOT the admin-
  gated API); (3) RFC 9116 `security.txt` on the org's website (OPT-IN
  via `--probe-web` only — default-off because the WebFetch hits the
  target's logs, telegraphing the investigation before responsible
  disclosure); (4) security@ email or security section in CONTRIBUTING/
  README.
- **Security-shape classification** added to Phase 2 entry gate as a
  fifth assessment alongside Q1–Q4. Concrete rubric: auth bypass, path
  traversal, injection, memory safety, crypto, info disclosure, supply
  chain, DoS via input. Three values: `yes | no | unknown`.
- **Pillar 4 mid-trigger** for security-shape re-classification. When
  P4 produces its first concrete file:line failure surface AND the gate
  classified `security_shaped: no`, pause and re-classify immediately
  so timing discipline shapes the rest of the investigation. Suppressed
  by `--not-security` and when gate already said yes.
- **Three new flags**: `--security` (force on), `--not-security` (force
  off; suppresses Pillar 4 mid-trigger), `--probe-web` (opt-in for the
  RFC 9116 web probe).
- **Filename guardrail**: drafts on the responsible-disclosure path are
  written as `.private-draft.md`; public-path drafts stay `.draft.md`.
  Filename is the primary guardrail (visible in `ls`, editor tabs,
  carrier UI); body header `> Delivery: ...` is the secondary reminder.
- **Halt-and-ask on probing-blocked + security_shaped** combination.
  When all four probes errored AND the finding is security-shaped, the
  skill HALTS and presents a four-option AskUserQuestion (retry / manual
  / proceed-public-anyway / abort) instead of silently defaulting to the
  public path. The silent-default would defeat the whole point of the
  security classifier.
- **Scratchpad frontmatter additions** under existing schema 1
  (additive, no schema bump): `security_shaped`, `disclosure` block
  with `chosen_path`, `probe_errors[]`, etc.

### Changed

- **Pillar 1 gate assertion strengthened**: every permalink in the
  scratchpad and the draft must use the FULL 40-character SHA, not
  abbreviated (7-12 char) forms from `git log` output. Short SHAs
  resolve on GitHub today but can collide over years; Pillar 1's whole
  point is durability against the future. SKILL.md now documents the
  `git rev-parse <short-sha>` recovery pattern for cases starting from
  short SHAs in `git log` output. First real-use dogfood (Prusa
  investigation, v0.1.1) produced a draft mixing full and abbreviated
  SHAs — this codifies the constraint.
- **Anti-squatting section** now states the precedence rule: responsible
  disclosure beats anti-squatting timing. The filename suffix encodes
  which discipline applies.

## [0.1.1] - 2026-04-15

### Fixes

- **Entry gate no longer routes the user through four sequential
  yes/no clicks.** Phase 2 now expects Claude to read the finding,
  form its own opinion on Q1–Q4 with one-sentence reasoning for each,
  and present the classification as a SINGLE AskUserQuestion with
  three options: proceed as classified, override specific answers,
  or go to quick-report regardless. The prior flow made the user do
  the cognitive work the skill was built to bring — a DX miss caught
  on first real invocation.
- **Target-repo resolution uses announcement, not a blocking prompt,
  in the common case.** Phase 1 now: if cwd is a git repo and a
  sensible slug derives, Claude announces the resolved target inline
  (`Target: grafana-loki (from cwd)`) and proceeds. The blocking
  AskUserQuestion only fires when cwd isn't a git repo (no sensible
  default available). `--target` flag remains the explicit bypass.
  This honors "don't guess silently" (announcement is visible) without
  making every invocation cost a confirmation click.

## [0.1.0] - 2026-04-14

Initial release. A reusable skill for applying investigative rigor to
non-trivial external-contribution findings before drafting an upstream
issue or PR.

### Features

- **Target-repo confirmation** at gate time, with cwd-derived slug
  pre-filled. Closes the silent-wrong-default failure mode for the
  common case where the user is investigating an upstream repo from
  a workspace directory (e.g., a give-back session).
- **Four-question entry gate**, with Q1 ("is the fix non-trivial?")
  as a hard gate. Routes routine fixes to a quick-report template
  instead of the full forensics ceremony.
- **Five investigation pillars** (playbook, not checklist):
  1. Pin your references — SHA-pinned permalinks required, branch
     URLs forbidden.
  2. Find structural twins.
  3. Read the history — distinguish stated intent from side-effect
     additions (the central prompt discipline).
  4. Disprove the current design — concrete file:line failure
     surfaces, no hand-waving.
  5. Trace the callers — exhaustive enumeration with admitted limits.
- **Per-pillar N/A discipline**: when a pillar doesn't apply, state
  it explicitly with a one-sentence reason. Silent skipping invites
  fabrication.
- **Two-file artifact model**: append-only `.notes.md` scratchpad +
  structured `.draft.md` output, both with self-describing schema-1
  YAML frontmatter.
- **Quick-report exit template** for the common-case routine fix —
  ready-to-post structure with permalink discipline preserved.
- **Draft template** abstracted from the gold-standard exemplar
  (Loki #21524). Treat as a mold, not a form: include the sections
  that fit the investigation, omit ones that don't.
- **Embedded exemplar** at `references/loki-21524.md` — local copy
  with provenance header, lazy-loaded by the skill prompt only when
  trigger conditions fire.
- **Quality checklist** doubles as anti-patterns reference and
  dogfood grading rubric. Pass bar: zero rigor fails, at most one
  N/A-with-reason on pillar items, zero draft-shape fails.
- **Escape hatches**: `--force`, `--quick-report`, `--resume`,
  `--skip-pillar`, `--target`.
- **Anti-squatting carrier integration** with `give-back`: skill
  produces the draft; reporter holds it privately while the fix PR
  is prepared; issue + PR posted close together to deter drive-by
  contributors.

### State location

Notes and drafts land at `$ISSUE_FORENSICS_HOME/<slug>/`, defaulting
to `~/.issue-forensics/`. Pattern matches `/codebase-audit`'s
`$AUDIT_HOME` → `~/.codebase-audits/`.
