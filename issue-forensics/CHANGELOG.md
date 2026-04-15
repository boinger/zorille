# Changelog

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
