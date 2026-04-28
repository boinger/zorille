---
date: 2026-04-27
decision: Path C — grep-prose discipline; no graph tool
status: closed
audit_trail: /Users/jeff.vier/.claude/plans/just-found-and-forked-linear-wand.md (developer-local; preserved for provenance)
related_changelog: 0.1.3
---

# Decision: graph-vs-grep for `/issue-forensics` Pillar 5

**Outcome:** Path C. Ship grep-prose discipline expansion in
`references/pillar-5-grep-discipline.md`. **No graph code lands in
zorille.**

## What was evaluated

A multi-round investigation considered three approaches to making
`/issue-forensics` Pillar 5 caller traces more reliable:

1. **Adopt GitNexus** — third-party tree-sitter knowledge graph + MCP
   server. License: PolyForm Noncommercial 1.0.0.
2. **Build zorille's own purpose-built code graph** — narrow-scope
   tree-sitter or libclang-based indexer with SQLite caching.
3. **Adopt scip-clang** (or scip-go / scip-typescript / scip-python)
   — Sourcegraph's SCIP indexers, Apache-2.0, multi-vendor.
4. **Path C — keep grep, expand the prose discipline.**

## Why each non-Path-C option was rejected

### Adopt GitNexus

- **License risk.** PolyForm Noncommercial 1.0.0 silently activates
  for commercial users — adoption tax that bounces a meaningful
  fraction of the user audience.
- **Single-vendor risk.** Maintained by akonlabs.com; relicense,
  abandonment, or v2 break each plausible inside 12 months.
- **Stale-index silent corruption.** `gitnexus context` returns
  `(file, line)` without SHA reconciliation; a stale index produces
  permalinks pointing to a tree the call graph doesn't reflect —
  exactly the failure mode `/issue-forensics` Pillar 1's GATE
  ASSERTION exists to prevent.

### Build a custom code graph (tree-sitter or libclang)

- **Wrong tool for the actual corpus.** The user's investigation
  history is C/C++ embedded firmware (Prusa Firmware Buddy).
  Tree-sitter parses raw text — preprocessor-blind. The structural
  features that defeat grep on C/C++ (`#ifdef` arms, macro-expanded
  calls, vtables, function-pointer dispatch) defeat tree-sitter for
  the same reason. Estimated recall ceiling: 20-35%.
- **Custom-build for C/C++ requires libclang**, not tree-sitter,
  which is roughly rebuilding scip-clang.
- **Decomposed effort estimate: 17-30 working days** vs the original
  plan's "1 week of focused work."

### Adopt scip-clang

- **scip-clang's install ceremony is itself adoption-hostile** —
  no homebrew formula despite docs (returns "no available formula"
  on `brew install sourcegraph/sourcegraph/scip-clang`); the
  recommended install is direct binary download from GitHub
  releases. Friction every user pays.
- **More importantly: there was nothing to adopt it for.** The full
  corpus audit (below) showed zero Pillar 5 failures grep didn't
  handle. scip-clang's value proposition — "find what grep missed"
  — has no missed-things to find.

## The corpus that decided it

Three investigations classified for failure type:

| # | Investigation | Language | Pillar 5 trace | Type |
|---|---|---|---|---|
| 1 | path-allowed-traversal-gaps (Prusa) | C++ | 7 callers in anonymous namespace inside one TU; `grep -n path_allowed src/connect/planner.cpp` is provably exhaustive | **A** (string-findable) |
| 2 | ac-fault-startup-debounce (Prusa) | C++ | 2 direct named-function calls (`is_ac_fault_active`); plus ISR arming context | **A** (string-findable) |
| 3 | Loki #21524 (mutex vestige) | Go | 5+ caller pathways, all direct method calls (`ForStream`); the *hard* work was reasoning about concurrency context per call site, not finding sites | **A** (string-findable) |

**A:B ratio: 3:0.** Every Pillar 5 trace in the corpus was solved by
grep + investigator judgment. None of them would have benefited from
graph tooling in any flavor.

## What's shipped

`/issue-forensics` v0.1.3:
- `references/pillar-5-grep-discipline.md` — per-language structural
  checklists, call-site context-reading framing, tool escape hatches
  documented as explicit non-defaults
- SKILL.md Pillar 5 prose tightened: two-phase framing (find vs
  reason about context), GATE ASSERTION preserved, lazy-load pointer
  to the new reference

The tool escape hatches (scip-clang, scip-go, scip-typescript,
scip-python, ast-grep, clangd) are documented in the reference as
**explicit non-defaults** with three required preconditions for use:
(1) per-language checklist exhausted, (2) trace still incomplete,
(3) missing calls are structural (Type-B), not string-findable
(Type-A). Each escape-hatch invocation must be logged in the
investigation's scratchpad.

## When to revisit

If accumulated escape-hatch usage logs across multiple investigations
show consistent Type-B failures that the per-language discipline
can't handle, the graph-tool approach can be reopened with **real
data** rather than speculation. The forcing function:

1. Investigators log scratchpad entries when they reach for tools
2. Quarterly (or on-demand) audit: how many investigations in the
   last N reached for an escape hatch? What languages? What
   structural features did the per-language checklist miss?
3. If the answer is "consistently more than ~20% of investigations
   need an escape hatch and it's the same language family," that's
   data the original 2026-04 evaluation didn't have. Re-run the
   investigation with the new corpus.

## Lessons captured

1. **The forking event was not a problem statement.** Tool-first
   thinking ("we just forked X, should we use it?") is a known
   failure mode. The actual question is always "what problem do
   we have, and what's the cheapest correct solution?"
2. **Kill criteria worked.** The plan's gate sequence (corpus
   thinness, Type A vs B classification, adoption friction) caught
   exactly this kind of "infrastructure looking for a problem to
   solve" scenario at ~2 hours of investigation cost vs weeks of
   wasted build.
3. **Reviewer voices were directionally right, sharper each round.**
   Two rounds of /autoplan dual-voice review (CEO/Eng/DX) +
   user-driven sharpening produced a kill decision the initial
   plan would not have reached.
4. **/issue-forensics's GATE ASSERTION is the actual discipline.**
   "Caller trace MUST admit its own limits" applies whether the
   tool is grep, scip-clang, or anything else. Building a graph
   would have been infrastructure to enforce a discipline that
   prose already enforces.
5. **Negative results are documentation.** This file is the
   artifact. If a future zorille contributor wonders "did we ever
   consider a graph tool?" — the answer is one read away rather
   than a re-investigation.
