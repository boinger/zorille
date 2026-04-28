---
name: issue-forensics
version: 0.1.3
description: |
  Apply investigative rigor to non-trivial external-contribution findings
  before drafting an upstream issue or PR. Four-question entry gate routes
  routine fixes to a quick-report template; substantive findings get a
  five-pillar playbook (SHA-pinned permalinks, structural twins, history
  with intent-vs-side-effect discipline, disproof of current design,
  exhaustive caller trace). Produces a structured draft modelled on
  Loki #21524, held privately until the fix PR is ready — reducing
  drive-by contributor squatting. Companion to give-back.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - Edit
  - AskUserQuestion
  - WebFetch
---

## Voice

Be direct and concrete. Name the file, the function, the line number. Show evidence, not impressions. Permalinks, not paths. If you claim existing code is wrong, prove it. If you don't know something, say so.

No filler, no academic hedging, no emotional language. Sound like an engineer producing evidence for a maintainer who has five minutes and ten other issues to triage.

## Preamble (run first)

```bash
# Shared helper scripts (invoke via: bash "$LIB_DIR/<script>.sh" <args>)
#   lib/slug.sh — canonical repo slug, shared with /codebase-audit, /plan-fixes
LIB_DIR="${CODEBASE_AUDIT_LIB_DIR:-$HOME/.claude/skills/codebase-audit/lib}"
[ -d "$LIB_DIR" ] || echo "WARNING: $LIB_DIR does not exist. Run ./setup from the zorille repo (or set CODEBASE_AUDIT_LIB_DIR)." >&2
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
CWD_SLUG=$(bash "$LIB_DIR/slug.sh" 2>/dev/null || basename "$REPO_ROOT")
echo "CWD_SLUG: $CWD_SLUG"
FORENSICS_HOME="${ISSUE_FORENSICS_HOME:-$HOME/.issue-forensics}"
echo "FORENSICS_HOME: $FORENSICS_HOME"
mkdir -p "$FORENSICS_HOME"
```

`lib/slug.sh` is shared with `/codebase-audit` and `/plan-fixes`. Same slug for the same repo. Do not inline slug derivation here — always invoke the shared script. `slug.sh` accepts an optional URL or path argument for cases where the investigation target is not cwd (see Phase 1 below).

# /issue-forensics — Upstream Investigation Forensics

You are investigating a non-trivial finding in a codebase — likely one you don't own — and preparing to file an upstream issue or PR. This skill applies a five-pillar playbook modelled on a gold-standard exemplar (Loki #21524), produces a structured draft, and keeps notes in a persistent scratchpad so you can resume across sessions.

The skill's job is NOT to substitute for judgment. The pillars are prompts, not a checklist. Apply what fits; state what doesn't.

## Arguments

- `/issue-forensics` — standard flow: target-repo prompt, entry gate, pillars if gated in, draft.
- `/issue-forensics --target <slug|path|url>` — bypass the target-repo confirmation prompt. Accepts a slug, filesystem path, or remote URL.
- `/issue-forensics --force` — skip the entry gate. Run the full pillar sweep on anything. For when you know it's worth the ceremony.
- `/issue-forensics --quick-report` — skip both the gate AND the pillars. Produce the quick-report template directly. For routine fixes you've already classified.
- `/issue-forensics --resume <path>` — reopen a specific scratchpad. Same-day same-slug auto-detection still runs by default; use this flag for manual selection.
- `/issue-forensics --skip-pillar <N>` — assert that pillar N (1–5) is not applicable. User reason is logged in the scratchpad. Can repeat: `--skip-pillar 2 --skip-pillar 3`.
- `/issue-forensics --security` — force security-shape classification ON. Skip the assessment in Phase 2; Phase 5.5 disclosure-path probe will fire.
- `/issue-forensics --not-security` — force security-shape classification OFF. Skip the Phase 2 assessment AND the Pillar 4 mid-trigger; Phase 5.5 disclosure-path probe will NOT fire even if pillar evidence later suggests otherwise.
- `/issue-forensics --probe-web` — opt-in for Phase 5.5 probe #3 (RFC 9116 `security.txt` on org website). Default-off because the WebFetch hits the target org's web logs, telegraphing the investigation.

Flags compose.

## Phase 1: Target-repo confirmation

**Ask first, don't guess — but don't waste a click on the obvious case.** The target repo determines where notes get written, so it must be visible before any other state accumulates. The common case (cwd IS the target) doesn't warrant a blocking prompt; announcing the derived target is enough — the user can interject or re-invoke with `--target` if wrong.

Resolution rules:

- **`--target <slug|path|url>` passed** → use it. Normalize via `bash "$LIB_DIR/slug.sh" "<arg>"`. No prompt. Announce the resolved slug.
- **cwd is a git repo AND cwd-derived slug exists** → derive from cwd. Announce the target inline (e.g., `Target: grafana-loki (from cwd)`) and proceed. No AskUserQuestion. If the user says "no, that's wrong" in their next message or types `--target ...`, restart the phase with the corrected value.
- **cwd is NOT a git repo** (no git remote, or user ran skill from a non-repo dir) → there is no sensible default. ASK via AskUserQuestion: "cwd isn't a git repo, so I can't auto-derive the target. What repo are we investigating?" with a type-in option.

**Edge case — URL without local clone:** if the user supplied a URL for a repo they haven't cloned locally, derive the slug, write notes, but flag in the scratchpad that local git operations (Pillar 3 archaeology) will be unavailable unless they clone. Some investigation still works from public GitHub data alone via WebFetch / `gh`.

**Do not make the user click when you have the information to decide.** The announcement pattern keeps target resolution visible without blocking on trivial confirmation.

## Phase 2: Entry gate

Four yes/no questions classify the finding, plus a fifth security-shape assessment that may trigger a disclosure-path probe later. If `--force` or `--quick-report` was passed, skip this phase.

**You, Claude, form the opinion — the user confirms or overrides.** You have the finding in front of you. Do not route the user through five sequential AskUserQuestion calls when you can reason about each question and put your answers on the table for a single veto step. That makes the user do the cognitive work the skill exists to do.

All four gate questions read the same direction: "yes" means forensics ceremony is warranted, "no" means lean toward the quick-report path.

**Q1 is a HARD GATE.** If Q1 = "no", exit to quick-report regardless of Q2–Q4. Q1 is qualitatively different from the others: a truly trivial fix (typo, version bump, one-liner) never earns the ceremony.

1. **Is the fix non-trivial?** (i.e. NOT a typo, version bump, import reorder, or obvious one-liner). *Hard gate. "No" exits immediately.*
2. Would a maintainer reading your claim be surprised?
3. Are you challenging or removing existing code (vs. adding new code in an unclaimed area)?
4. Does the finding touch a non-trivial design decision? (thread safety, invariants, API contracts, performance characteristics)

**Threshold:** 2+ "no" answers across Q1–Q4 (including the Q1 hard gate) → exit to quick-report. Otherwise → proceed to Phase 4.

### Security-shape assessment (fifth dimension)

Alongside Q1–Q4, classify whether the finding is **security-shaped**. This is independent of the gate threshold: a finding can be security-shaped AND quick-report (rare but possible — e.g., trivial fix to an exposed credential), or pillar-worthy AND not security-shaped. The classification routes whether Phase 5.5 (Disclosure path check) fires later.

Concrete rubric — finding is security-shaped if it involves any of:

- auth / authz bypass
- path traversal, directory escape, symlink follow
- injection (SQL, command, template, header, log, LDAP, XPath, etc.)
- memory safety (buffer overflow, UAF, double-free, OOB read/write)
- cryptographic misuse (weak primitives, bad IV/nonce, timing leaks)
- information disclosure (secret leakage, side-channel)
- supply chain (dep pinning, build-time tampering, update channel)
- DoS via user input (algorithmic complexity, resource exhaustion)

If ambiguous, classify as `unknown` and note the uncertainty — Phase 5.5 will re-evaluate with pillar evidence.

**Override flags:**
- `--security` forces `security_shaped: yes` regardless of assessment.
- `--not-security` forces `security_shaped: no` regardless of assessment. **Pillar 4 mid-trigger respects this** — if the user has explicitly overridden, do not re-prompt even if pillar evidence later surfaces concrete failure surfaces.

### How to run this phase

1. Read the finding context the user has shared (prior conversation, a scratchpad, an audit report, whatever's available). If no finding context is visible yet, ask: "What's the finding? One sentence is enough." — that's the ONLY question you should need to ask before classifying.

2. Form your own answer to each of Q1–Q4 AND security-shape with a one-sentence reason drawn from the finding. Write them out as a block. Include the verdict.

   Example:

   ```
   Gate classification for <finding description>:
     Q1 non-trivial?          yes — <reason from the finding>
     Q2 maintainer surprise?  yes/no — <reason>
     Q3 challenging code?     yes/no — <reason>
     Q4 design decision?      yes/no — <reason>
     Security-shaped?         yes/no/unknown — <reason against rubric>

   Score: N/4 yes → <proceed with full pillar sweep | exit to quick-report>
   Security-shaped: <yes|no|unknown> → <will run Phase 5.5 disclosure probe | no probe needed | revisit at Phase 5.5 with pillar evidence>
   ```

3. Present it as a SINGLE AskUserQuestion with three options:
   - "Proceed as classified" (recommended)
   - "Override specific answers" (user tells you which to flip and why)
   - "Go to quick-report regardless" (user overrides toward the lighter path)

4. Log the final answers (after any user overrides) in the scratchpad frontmatter's `gate` field and `security_shaped` field (Phase 7).

### When to ask more

If the finding context is genuinely ambiguous on a specific question — you have low confidence and a correct classification matters — say so in your reasoning ("Q2 I'm unsure — gap might be documented in CONTRIBUTING.md, which I haven't read") and let the user factor it in. Don't fake certainty. But also don't convert every question into a user click; the skill's job is to bring reasoning, not just forms.

## Phase 3: Quick-report exit (common-case output)

Fired when the gate routes here, or when `--quick-report` was passed. Output the following template, pre-filling what you can see in the conversation and leaving placeholders for what you can't:

```
## Quick-report template

**What I observed**
- <1 sentence with permalink pinned to current HEAD SHA>

**How to reproduce**
- <2-3 bullets OR "see attached test">

**Proposed fix**
- <1 sentence: the mechanical change>
- <Link to PR if opening one in parallel>

**Checked**
- [ ] Followed CONTRIBUTING.md (style, commits, DCO if required)
- [ ] Ran project's test suite locally
- [ ] Searched existing issues for duplicates

---
Quick-report mode. If your gut says this is more than a typo after all,
re-run with `--force` to invoke the full pillars.

Timing reminder: if submitting both an issue AND a PR, post them close
together. Even routine fixes get scraped by drive-by contributors.
```

No scratchpad or draft file is written in quick-report mode — the template is printed inline and the session ends. Total time-to-output: seconds.

## Phase 4: Opening announcement

If the gate routed to the full pillar sweep, open with a short announcement so the user knows what's happening:

```
Starting issue-forensics investigation.
  Target: <SLUG>
  Notes:  <FORENSICS_HOME>/<SLUG>/<YYYY-MM-DD>-<topic>.notes.md
  Draft:  <FORENSICS_HOME>/<SLUG>/<YYYY-MM-DD>-<topic>.draft.md
  Pillars: apply what fits; state what doesn't.
  Expect: 15–40 minutes for a full sweep.
  Abort: type "stop" — notes are preserved.
```

Ask the user for a `<topic>` string if one hasn't been supplied. Sanitize via slug rules (lowercase, `[a-z0-9-]`, collapse runs, trim).

Before opening the scratchpad, check for existing same-day same-slug notes:

```bash
ls "$FORENSICS_HOME/$SLUG/$(date +%Y-%m-%d)"-*.notes.md 2>/dev/null
```

If any exist, prompt via AskUserQuestion:

> "Found existing scratchpad(s) from today: `<path(s)>`. Resume or start fresh?"
>
> Default: "Resume `<most-recent-path>`" (pre-selected when topic string matches or overlaps)
> "Start fresh"

**Order matters:** ALWAYS prompt first. Only on "Start fresh" do you auto-increment to `<topic>-01.notes.md`, `<topic>-02.notes.md`, etc. The opposite order would silently fork investigations.

Write the scratchpad frontmatter (Phase 7) and proceed to pillars.

## Phase 5: Pillar playbook

**Five pillars, not ordered, not a checklist.** Apply what the investigation needs. Each pillar has an N/A discipline: if it doesn't apply, state so in the notes with a one-sentence reason. Silent skipping is forbidden — it invites fabrication.

If `--skip-pillar <N>` was passed, skip pillar N and log the user's reason (ask for one if not provided).

### Pillar 1: Pin your references

Capture the current commit SHA at investigation start. **Always the FULL 40-character SHA**:

```bash
cd <target-repo-local-path>  # or fetch via gh/WebFetch if no local clone
git rev-parse HEAD            # full 40-char SHA, never abbreviated
```

**GATE ASSERTION: every file reference in the scratchpad and the draft MUST use a SHA-pinned permalink with the FULL 40-character SHA**, of the form `<repo-url>/blob/<SHA>/<path>#L<line>-L<line>` (e.g., `https://github.com/grafana/loki/blob/8553815420c01d33d7da4f56b80df8e3a36b1d9b/path/to/file.go#L42-L58`).

- **Branch URLs** (`/blob/main/...`, `/blob/master/...`) are forbidden — they silently drift when the branch moves.
- **Bare file paths** without permalinks are forbidden in the final draft.
- **Abbreviated SHAs** (the 7-12 char form from `git log` output, e.g. `3d0ad25f12`) are forbidden in the final draft. They resolve today on GitHub but can collide over years as the repo grows. Pillar 1's whole point is durability against the future; short SHAs defeat it.

When constructing permalinks from `git log` output (which prints abbreviated SHAs by default), always re-derive the full SHA before building the URL:

```bash
git rev-parse <short-sha>     # returns the full 40-char form
```

Use the full form in every permalink. No exceptions.

Record the SHA in the scratchpad frontmatter as `commit_sha` (Phase 7).

### Pillar 2: Find the structural twins

Search for structurally similar code in the same package / module / codebase. The strongest argument for "this one is wrong" is often "three siblings exist, and they all do it differently."

Concrete operations:
- `grep` / `rg` for the same function signature, type shape, or pattern in nearby files.
- For Go: same interface implementations in the same package.
- For Python / TypeScript: same class / type aliases.
- For any language: same-named methods (`ForStream`, `Process`, `Execute`) across related types.

**N/A rendering:** if the code has no analogues in the package ("this is a one-of-a-kind structure with no siblings to compare against"), state that explicitly and move on. Do not grind — if you can't find twins, say so.

### Pillar 3: Read the history

The most load-bearing pillar. Use git and PR review to separate stated intent from side-effect additions.

Canned commands:

```bash
git log -S '<symbol>' -- <path>       # track commits that added/removed the symbol
git log -S '<phrase>' -- <path>       # track commits that added/removed specific text
git blame <path>                      # line-level authorship
git log --follow -p <path>            # full patch history even through renames
gh pr view <NNNN>                     # PR description + reviews
gh pr diff <NNNN>                     # actual diff
```

**Critical prompt discipline: for any PR you surface, extract three things SEPARATELY:**

1. **The PR's stated intent** — title, description, any motivating issue, review discussion threads. Quote verbatim when it matters.
2. **Changes that match that intent** — the commits / hunks that advance the stated goal.
3. **Changes that don't match or weren't discussed** — the hunks that arrived alongside but weren't argued for. This is the side-effect category.

Flattening these into a single summary is the default LLM failure mode and silently undermines every downstream claim. If all changes match the intent, say so explicitly.

Example of the distinction (the whole point of this pillar):

**BAD (flattened):** "PR #9949 added pipeline cache reset logic along with a mutex to coordinate access. The mutex ensures safe concurrent use."

**GOOD (distinguished):** "PR #9949's stated intent was to reset pipeline caches to fix OOM. The mutex appears in commit 3 of 7 with no accompanying commit message or review comment. No reviewer asked about thread safety. The mutex arrived for the OOM fix scope; its thread-safety guarantees were never argued for."

Same facts, completely different weight. Only the second earns the right to question the mutex.

**N/A rendering:** degrades gracefully on:
- Squash-merged repos → commit-message archaeology only. State: "Repo is squash-merged; per-commit intent is unavailable. Analysis based on merge commit + PR discussion."
- Repos with no public PR threads (private, self-hosted without GitHub/GitLab parity) → state so. P3 may become a stub in these cases.

### Pillar 4: Disprove the current design

If you're claiming existing code is wrong / vestigial / broken, you must SHOW it, not just assert it. State at least one concrete file:line scenario where the current code doesn't work as apparently intended.

Template for a disproof entry:

```
1. **<Short name of bug surface>.** <file:line permalink>. <Specific
   mechanical description: the race, the contract violation, the
   unreachable branch, etc.>
```

Multiple surfaces strengthen the argument. Diminishing returns after three or four — pick the clearest, not the longest list.

**Per-pillar 4 discipline:** "could theoretically break" without a concrete scenario is a fail. If you can't construct a concrete failure scenario, downgrade your claim from "this is broken" to "this is questionable" in the draft, and acknowledge the limit.

**N/A rendering:** P4 only applies when you're disproving existing code. If your finding is purely additive ("this new functionality is missing"), P4 has no work to do.

**Mid-pillar trigger — security-shape re-classification.** When P4 produces its FIRST concrete file:line failure surface, AND the gate classified `security_shaped: no`, AND `--not-security` was NOT passed: pause and re-classify immediately rather than waiting for Phase 5.5.

```
Pillar 4 surfaced a concrete failure scenario:
  <file:line> — <one-line description>

This looks security-shaped now (gate classified: no).
Pause investigation to decide disclosure path?

  A) Yes — switch to responsible-disclosure posture now. Halt pillar
     work. Run Phase 5.5 immediately.
  B) Defer — continue investigation; re-confirm at Phase 5.5 start.
  C) Override — no, still not security-shaped (record reason).
```

The point is to catch security shape BEFORE the user invests another 15-30 min investigating publicly when they should be in private-disclosure mode. The Phase 5.5 start re-confirmation remains as the safety net for cases where the user picked Defer or where the trigger didn't fire.

**Suppression conditions** — the mid-trigger does NOT fire when:
- `--not-security` was passed (user explicitly overrode; honor that).
- Gate already classified `security_shaped: yes` (posture is already correct).
- Gate classified `security_shaped: unknown` and pillar evidence is also ambiguous (re-evaluate at Phase 5.5 start instead).

### Pillar 5: Trace the callers

Enumerate every production call site you can find, with permalinks. The goal is to confirm or deny the scenarios where the problematic behavior could fire.

**Two phases of work — keep them mentally separated:**

1. **Find the call sites** (mostly grep work; usually the easier half)
2. **Reason about each site's context** (concurrency, timing, dispatch polarity, lifetime, who the caller's caller is — investigator judgment, no tool produces this)

Most Pillar 5 failures are in the second phase. A complete list of call sites that all read the same way to the LLM is *worse* than a shorter list with annotated context. When in doubt, fewer sites with clearer context wins.

#### Finding call sites — base technique

- `grep` / `rg` for the function name (tight if it's unique, looser if it's common like `Run`).
- `gh search code` for usages in other repos if the symbol is public API and you suspect external consumers.
- Language-aware: Go package-qualified `pkg.FuncName`, Python `from x import FuncName`, TypeScript import traces.

#### When to load the per-language reference

Per-language structural-feature checklists (C/C++ macros / vtables / anonymous namespaces, Go interface satisfaction, Python MRO, TS overloads / re-exports) plus tool escape hatches (scip-\*, ast-grep, clangd) live at `references/pillar-5-grep-discipline.md`. **Do not load on every invocation** — load when:

- Pillar 5's initial grep pass returns fewer callers than the disproof scenario implies (e.g., Pillar 4 surfaced 3 distinct failure modes but grep found only 1 caller — suspicious gap)
- The target language has known structural-indirection patterns and the finding's correctness depends on caller exhaustiveness (C/C++ with macros or vtables, Go with widely-implemented interface methods, Python with metaclasses or dynamic dispatch)
- An anonymous-namespace / closed-scope proof would let you assert exhaustiveness ("anonymous namespace, search is closed to this TU") and the symbol is a candidate for that

The reference also documents the tool escape hatches (scip-clang, scip-go, ast-grep, etc.) as **explicit non-defaults** — use only when the per-language checklist has been exhausted, the trace is still incomplete, and the missing calls are structural rather than string-findable. If you reach for these tools, log the reason and friction in the scratchpad — accumulated escape-hatch invocations across investigations is the signal for whether to revisit the (currently rejected) graph-tool approach.

#### Reasoning about each call site (the harder half)

Once you have the candidate caller set, annotate each: concurrency context (goroutine? errgroup? ISR? serialized?), lifetime/freshness (fresh instance per call vs reused?), polarity (`if X` vs `if !X` — same callee, opposite control flow), trust shape (input from peer/internal vs user/network?). These annotations are what makes Pillar 5 evidence vs. a list.

The Loki #21524 exemplar's Pillar 5 (`references/loki-21524.md`, "Why no production caller hits any of these races" section) is the model: each of 5+ caller pathways is annotated with concurrency context, freshness, and lifetime.

**GATE ASSERTION: the caller trace MUST admit its own limits.** Phrase earned humility explicitly: "If there's a caller I missed — especially one where `<the problematic sharing pattern>` is genuinely present — I'd want to hear about it." Fake exhaustiveness (claiming to have traced all callers when you can't verify external consumers) is a fail.

**N/A rendering:** for library code with unknown external consumers, state the boundary: "Traced callers within this repo; external consumers unknown."

## Phase 5.5: Disclosure path check (security-shaped findings only)

Conditional phase. Fires only when `security_shaped` is `yes` after re-evaluation. Skipped entirely when `--not-security` was passed.

### Re-evaluation (start of phase)

The Phase 2 gate classified `security_shaped` based on the finding description alone. Now you have pillar evidence in hand. Re-classify:

- **If gate said NO but pillars surfaced security shape** (e.g., Pillar 4 found a concrete file:line memory-safety surface and the user did not select "Override" at the mid-trigger): announce "Pillar evidence shifted classification: this looks security-shaped now. Running disclosure-path probe." Update `security_shaped: yes` in the scratchpad. Proceed with the probe.
- **If gate said YES but pillars did not confirm** (the suspected vulnerability didn't materialize, no disprove succeeded): announce "Gate flagged security-shaped but pillar evidence didn't confirm. Skipping disclosure-path probe." Update `security_shaped: no`. Skip to Phase 6.
- **If gate and pillars agree**: proceed without a re-classification notice.

Override flags: `--security` forces yes regardless of pillar evidence; `--not-security` forces no AND skips the entire phase. The Pillar 4 mid-trigger respects `--not-security` — if the user has explicitly overridden, do not re-prompt even if pillar evidence later surfaces concrete failure surfaces.

### Probes (4 surfaces)

Probe the target project's disclosure surfaces BEFORE producing the draft. Responsible disclosure takes precedence over the anti-squatting timing discipline: if the project publishes a contact or policy, use it.

Probe in this order, surface the first hit:

#### Probe 1: Security policy (GitHub-native, multi-source fallback)

```bash
# First: GitHub community profile API tells us if a policy is registered
POLICY_URL=$(gh api repos/<owner>/<repo>/community/profile \
  --jq .files.security.url 2>/dev/null)

# If null, fall through to file probes (some repos have SECURITY.md
# without registering it via the community profile UI):
```
if [ -z "$POLICY_URL" ] || [ "$POLICY_URL" = "null" ]; then
  # Try .github/SECURITY.md
  gh api repos/<owner>/<repo>/contents/.github/SECURITY.md \
    --jq .download_url 2>/dev/null
  # Then root SECURITY.md
  gh api repos/<owner>/<repo>/contents/SECURITY.md \
    --jq .download_url 2>/dev/null
fi
```

First hit wins. Read the file content (`gh api ... --jq .content | base64 -d`) for the actual disclosure instructions.

**Cached-URL edge case:** if community/profile returns a URL but the underlying file has been deleted since the GitHub cache populated, the API still returns the stale URL. Before surfacing it as the disclosure path, test it with a HEAD request (e.g., `gh api -X HEAD <url> -i 2>&1 | head -1`). If the URL 404s when followed, fall through to the `.github/SECURITY.md` and root `SECURITY.md` file-probe fallbacks rather than reporting a dead URL as the disclosure path.

#### Probe 2: GitHub private vulnerability reporting (UI-scrape, NOT API)

The `gh api repos/<owner>/<repo>/private-vulnerability-reporting` endpoint requires admin auth and returns 403 for external investigators. Detect via the public new-advisory page instead:

```bash
# Returns 200 if PVR is enabled, 404 if not.
gh api repos/<owner>/<repo>/security/advisories/new -i 2>/dev/null \
  | head -1 | grep -qE '^HTTP/[12].* 200' && echo "PVR_ENABLED"
```

If enabled, the disclosure path is "Click 'Report a vulnerability' on the repo's Security tab" — link to `https://github.com/<owner>/<repo>/security/advisories/new`.

> **Brittleness note:** This probe relies on unofficial GitHub UI behavior (HTML-page-via-API-path, not a published JSON API contract). GitHub may have changed the status code behavior at any time — return 200 always with a "PVR not enabled" page, return 403 for unauthenticated requests, redirect to a login page, etc. If PVR detection starts producing obviously-wrong results (e.g., every repo reports enabled, or every repo reports disabled), revisit the probe — GitHub may have changed the behavior. The probe would otherwise silently produce wrong answers.

#### Probe 3: RFC 9116 `security.txt` (OPT-IN via `--probe-web`)

This probe is OFF by default because the WebFetch hits the target org's web server logs, telegraphing the investigation before responsible disclosure. Only fires when the user passes `--probe-web` or accepts a one-time prompt during this phase.

When fired, ONLY use authoritative GitHub-API-derived domains. Never guess TLDs from the owner name — `<owner>.com` may be an unrelated party that happens to own that domain, and probing it leaks information about your investigation.

```bash
# Step 1: try the repo's homepage field
DOMAIN=$(gh api repos/<owner>/<repo> --jq .homepage)

# Step 2: if empty, try the org's blog field
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "null" ]; then
  DOMAIN=$(gh api orgs/<owner> --jq .blog)
fi
```

If a domain is found, WebFetch:
- `https://<domain>/.well-known/security.txt`
- `https://<domain>/security.txt` (legacy fallback)

If both `homepage` and `blog` are empty/null, SKIP probe #3. Log "no authoritative org domain known — skipped probe #3."

**Expires field handling** (RFC 9116 §2.5.5): if the security.txt has an `Expires:` field and the date has passed, treat the probe as "found-but-stale" — surface the contact info to the user but flag "WARNING: security.txt expired on <date>; org may have changed disclosure policy. Verify before submitting." Don't silently treat expired files as absent.

#### Probe 4: `security@` email or security section in CONTRIBUTING.md / README

```bash
# Pull both files via gh API (no need for local clone)
for FILE in CONTRIBUTING.md README.md docs/CONTRIBUTING.md; do
  gh api repos/<owner>/<repo>/contents/$FILE --jq .content 2>/dev/null \
    | base64 -d \
    | grep -iE 'security[:@_-]|vulnerab|disclose|cve|hackerone|bugcrowd'
done
```

Manually inspect any matches. Skip generic boilerplate (`security@example.com`, third-party platform mentions without org context).

### Probe failure handling

Each probe can fail in non-"not-found" ways: gh auth missing, WebFetch TLS error, rate limit, network timeout. On any probe failure (as distinct from a clean "no policy found" result):

- Log the specific error in the scratchpad under `disclosure.probe_errors[]` (see frontmatter schema below).
- Continue to the next probe — never let one probe's failure block the rest of the sequence.

### After all four probes

Three terminal states:

**A) At least one clean hit** → surface the policy and route the draft to the responsible-disclosure path (`<topic>.private-draft.md` filename, body header, follow the policy's instructions).

**B) Zero clean hits, zero errors** ("nothing found" cleanly) → log "no published disclosure policy found" in the scratchpad and proceed with the default anti-squatting delivery path (`<topic>.draft.md` filename). Record the negative result so you don't imply you skipped the check.

**C) Zero clean hits, ≥1 errors** ("probing blocked"): split based on classification:

- **`security_shaped: no`** → proceed with the public path, with a body-header note "could not verify policy due to probe errors; see `disclosure.probe_errors` in scratchpad." Acceptable risk because the finding isn't security-shaped.

- **`security_shaped: yes`** → **HALT. Do NOT silently default to the public path.** Ask the user explicitly via AskUserQuestion:

  ```
  All four disclosure probes errored. Cannot verify whether this
  project publishes a disclosure policy. This finding is classified
  security-shaped, so silently posting publicly could violate
  responsible-disclosure norms.

    A) Retry probes (check gh auth, network, etc., then re-run Phase 5.5)
    B) Manually specify disclosure path (enter URL or email)
    C) Proceed with public path anyway (flag uncertainty in body header)
    D) Abort — preserve scratchpad, decide later
  ```

  Halt is the right default for security-shaped + all-errored because the silent-proceed-to-public failure mode is exactly the responsible-disclosure violation the skill exists to prevent.

### Delivery path branching

Once the probe completes, set the delivery path on the draft. The **filename is the primary guardrail**; the body header is a secondary in-file reminder. Filename catches the case where someone copy-pastes the body into a public issue box without reading the header.

| Probe result | Filename | Delivery instructions |
|---|---|---|
| Security policy URL | `<topic>.private-draft.md` | Follow the policy's instructions |
| Private vulnerability reporting enabled | `<topic>.private-draft.md` | Submit via `https://github.com/<owner>/<repo>/security/advisories/new` |
| SECURITY.md (any location) | `<topic>.private-draft.md` | Follow the contact/process it documents |
| RFC 9116 security.txt (probe-web fired) | `<topic>.private-draft.md` | Use the `Contact:` field; respect `Preferred-Languages`. If `Expires` has passed, surface the warning before submitting |
| security@ email or contact in CONTRIBUTING/README | `<topic>.private-draft.md` | Email per standard responsible-disclosure norms |
| Nothing found (clean) | `<topic>.draft.md` | Default public path (anti-squatting timing applies) |
| Probing blocked (all errored) | `<topic>.draft.md` (with override note) | Surface "could not verify policy" to user; default to public path but flag uncertainty in the body header |

The draft's **content** doesn't change; the **filename and delivery header** do.

Body header (top of file, before TL;DR, under frontmatter) — secondary reminder:

```
> Delivery: RESPONSIBLE DISCLOSURE via <path>. Do not post publicly
> until coordinated timeline is resolved.
```

or:

```
> Delivery: PUBLIC issue + PR. No disclosure policy found; searched
> security policy, GitHub private reporting,
> [RFC 9116 (skipped — opt-in only),] CONTRIBUTING.md / README.
```

**Filename guardrail rationale:** the body header is paste-strippable. The filename is visible in `ls`, in editor tabs, and in any `give-back` carrier UI — much harder to ignore. Both layers together because defense-in-depth is cheap when the marginal cost is one file rename.

## Phase 6: Draft template (writing-it-up)

Once pillar evidence has accumulated in the scratchpad, produce the structured draft at `$FORENSICS_HOME/$SLUG/$(date +%Y-%m-%d)-<topic>.draft.md`.

**The template below is a MOLD, not a form.** Three sections are always present; three are pillar-gated (include when pillar produced evidence, omit cleanly when the pillar went N/A); three are situationally-gated (include only when the specific deliberation is load-bearing, otherwise omit).

```
## TL;DR

<One-sentence finding: what's wrong, which file/symbol, at which SHA>.
<One-sentence mechanism: why it's wrong — vestigial, broken,
inconsistent, violates contract at X>. <Optional: one-sentence scope
clarification.>

I'd like to propose <proposed action>. Happy to send a PR — wanted
to flag the <design question / historical context / scope decision>
first since <reason>.

All file references in this issue are permalinks pinned to
[`<SHA>`](<repo-url>/tree/<SHA>) so they survive line-number drift.

## <Strongest-argument section — name it concretely>

<One-paragraph strongest argument. Name it: "The structural twin
argument," "The contract violation argument," "The disproof
argument." Not generic "Evidence" or "Analysis.">

<Evidence with SHA-pinned permalinks. Format that makes structural
relationships visible — bulleted siblings, numbered contradictions,
before/after code blocks.>

<Closing sentence stating the inferred position. "X is the anomaly,
not the standard." — or equivalent.>

## [P3] History — how the <anomaly / mistake / vestige> got there

[Include if Pillar 3 produced evidence. Omit section entirely if
P3 went N/A.]

The <contract / invariant / pattern> was established in [#<earlier-PR>
(<date>, @<author>)](<PR-link>) — "<PR title>." <What it fixed /
established. Scope. Key artifacts added with permalinks.>

**<One sentence stating what the earlier PR did NOT change.>**

[<Later-PR> (<date>)](<PR-link>) — "<Later PR title>" — <stated
intent>. <Context.>

As a side effect, <later-PR> also <the change being questioned>.
**The PR description never mentions <the thing>. The review
discussion is <summary>.** <Any follow-up evidence.>

`git log -S '<symbol>' -- <path>` since then shows only <later-PR>
itself. <The thing> has not been touched in <N> years.

## [P4] Disproof of the current design

[Include if Pillar 4 produced concrete failure surfaces. Omit if P4
went N/A.]

If someone wanted to rely on <the questioned mechanism>, it wouldn't
work. <N> bug surfaces:

1. **<Short name of bug surface>.** <permalink>. <Specific description.>
2. **<Short name of next surface>.** <permalink>. <Description.>
3. **<Short name of next surface>.** <permalink>. <Description with
   conditional qualifiers if needed.>

A correct <fix> would need to cover all <N>. The current <mechanism>
covers none of them completely.

## [P5] Caller trace — why no production caller hits this

[Include if Pillar 5 produced a trace. Omit if P5 went N/A.]

I traced every production call site I could find. I could not
identify a caller that <triggers the bug>:

- **<Call site 1>** ([`<file:line>`](<permalink>)) — <what the
  caller does; why it's safe>.
- **<Call site 2>** — <ditto>.
- **<Low-concurrency or adjacent callers>** — <list with one-line
  reasons each>.

If there's a caller I missed — especially one where <the problematic
pattern> is genuinely present — I'd want to hear about it, because
that would change the right fix.

## Proposal

<Mechanical description of the fix: what gets removed, added,
changed. Include specific file paths.> Net diff: ~<N> lines
<removed/added>, ~<M> lines of <doc comments / tests / assertions>
added. <One-sentence behavior-change claim.>

## [situational] What this is NOT

[Include when scope boundary is load-bearing — usually when a bigger
alternative fix exists and you want to preempt "why not do the
bigger thing?" Otherwise omit.]

**<Name the bigger alternative fix>.** That would be the right fix
*if* <condition>, but <evidence that the condition isn't currently
met>, and doing it properly would touch <scope estimate>. If a future
contributor <encounters the condition>, the right call at that point
is either (a) <smaller pattern> or (b) <larger targeted pattern>.
That decision belongs to someone with a concrete use case in hand.

## [situational — rarely] Why post this as an issue instead of just a PR

[Include only if issue-vs-PR deliberation is genuinely the question.
Most drafts omit this section. Indicator it belongs: you are flagging
a design decision for the maintainers before writing code, not just
explaining your workflow.]

Two reasons:

1. <First reason — usually: removes existing code; dialog before
   wasted PR.>
2. <Second reason — usually: framing matters; cleanup vs functional
   fix changes reviewer posture.>

## [situational] Alternative if <primary> isn't preferred

[Include when you have a defensible fallback worth naming upfront.
Otherwise omit.]

If <primary-rejection-reason> is the consensus, I'm happy to send a
smaller PR that just (a) <minimal-scope change> and (b) <second
minimal change>. That still improves the state of things without the
<architectural question>, and leaves the <bigger decision> for later.
```

**Rendering rules:**

- **Pillar-gated sections** (P3, P4, P5): DROP the section from the draft if the pillar went N/A in the scratchpad. Don't leave a placeholder or write "N/A."
- **Situational sections**: include only when the corresponding deliberation is load-bearing for this particular investigation. Default: drop. "Why issue vs PR" in particular should be present in a minority of drafts.
- **Three always-applicable sections** (TL;DR, strongest-argument, Proposal) must always be present.

## Phase 7: Write artifacts

Two files per investigation, both with self-describing frontmatter.

**Notes file** — `$FORENSICS_HOME/$SLUG/<YYYY-MM-DD>-<topic>.notes.md`:

```markdown
---
schema: 1
slug: <SLUG>
target_repo: <remote-url-or-path>
commit_sha: <SHA>
topic: <sanitized-topic>
started: <ISO-8601-UTC>
gate:
  q1_non_trivial: <yes|no>
  q2_maintainer_surprise: <yes|no>
  q3_challenging_code: <yes|no>
  q4_design_decision: <yes|no>
security_shaped: <yes|no|unknown>
pillars_applied:
  p1: <done|na: reason>
  p2: <done|na: reason>
  p3: <done|na: reason>
  p4: <done|na: reason>
  p5: <done|na: reason>
disclosure:           # Only present when security_shaped: yes; written by Phase 5.5
  checked: <ISO-8601-UTC>
  policy_url: <url or null>
  private_reporting_enabled: <true|false|unknown>
  security_md_path: <path or null>
  security_txt_url: <url or null>     # Only if --probe-web fired
  contact_email: <email or null>
  chosen_path: <"policy" | "private_reporting" | "security_md" | "security_txt" | "email" | "public" | "blocked">
  probe_errors:
    - probe: <"community_profile" | "security_md_github" | "security_md_root" | "private_reporting" | "security_txt" | "contact_grep">
      error: <one-line description>
---

# Investigation notes: <topic>

## Pillar 1: Pin references
<evidence>

## Pillar 2: Structural twins
<evidence or N/A with reason>

## Pillar 3: History
<evidence or N/A with reason>

## Pillar 4: Disproof
<evidence or N/A with reason>

## Pillar 5: Callers
<evidence or N/A with reason>
```

**Draft file** — same directory, but with one of two filenames depending on the Phase 5.5 delivery branch:

- `<YYYY-MM-DD>-<topic>.private-draft.md` — when responsible disclosure applies (any clean Phase 5.5 hit).
- `<YYYY-MM-DD>-<topic>.draft.md` — when the public path applies (no policy found, or `security_shaped: no`).

The filename suffix is the **primary guardrail** preventing accidental public posting of a responsibly-disclosed finding. Same frontmatter as the notes file (enables migration and cross-file consistency).

Both `security_shaped` and `disclosure` are additive fields under schema 1. Consumers under schema 1 ignore unknown fields, per the additive-changes-don't-require-bump rule. Future schemas can add more (`linked_pr_url`, `draft_version`, etc.) without touching existing readers.

## Reference: the gold-standard exemplar

A worked example lives at `references/loki-21524.md` (relative to this skill file). **DO NOT read it on every invocation** — it's long, and loading by default wastes tokens on investigations that don't need it. Read it when any of these triggers fire:

1. The user asks "what does good look like?" or equivalent.
2. The user explicitly asks to see the exemplar.
3. Before producing the final draft, IF the scratchpad feels thin or the pillars produced uneven evidence — compare against the exemplar's structure to spot gaps.
4. When the investigation drifts away from concrete file:line evidence into hand-waving — re-reading the exemplar resets the rigor bar.
5. When the user asks for format help on a specific section ("how should I phrase the 'What this is NOT' section?") — point at the exemplar's corresponding section and adapt.

The template in this SKILL.md is the shape. The exemplar is the tone and substance reference. Use them together.

## Quality checklist — reference + grading rubric

Each item is a yes/no check. Grades a draft pass/fail. Use it during writing AND as the dogfood rubric for judging whether the skill is delivering Loki-grade output.

**Rigor:**

- [ ] Every file reference uses a SHA-pinned permalink. Branch URLs are a fail.
- [ ] All permalinks use the FULL 40-character SHA, not abbreviated (e.g., `3d0ad25f1228eac83fb295696ae795c99ec5a91b9`, not `3d0ad25f12`). Short SHAs resolve on GitHub today but can collide over years as the repo grows. Pillar 1's whole point is durability — abbreviated SHAs defeat it.
- [ ] Claims about "existing code is wrong / broken / vestigial" are backed by file:line evidence, not hand-waving.
- [ ] No emotional language ("clearly broken," "obviously wrong"). Evidence carries the weight.
- [ ] For security-shaped findings: checked GitHub community profile, SECURITY.md (.github/ and root), GitHub private vulnerability reporting status, RFC 9116 security.txt on org website (if `--probe-web` fired), and security@ contact in CONTRIBUTING.md/README. Delivery path on the draft (filename suffix + body header) respects the result, or explicitly notes "no policy found" after probing.

**Pillar outputs:**

- [ ] P1: Commit SHA stated upfront in the draft; all permalinks pinned to that SHA.
- [ ] P2: Structural twins cited with permalinks, OR explicit N/A with one-sentence reason.
- [ ] P3: If history applies, stated intent is SEPARATED from side-effect additions. Flattening is a fail.
- [ ] P4: If disproving current design, at least one specific file:line failure surface. "Could theoretically break" without a scenario is a fail.
- [ ] P5: Caller trace with permalinks, OR explicit N/A with reason. Trace admits its limits. Fake exhaustiveness is a fail.

**Draft shape:**

- [ ] TL;DR present with finding + proposed action.
- [ ] Strongest-argument section has a concrete name. Not "Evidence" or "Analysis."
- [ ] Proposal names specific files/scope and estimates net diff size.

**Pass bar:** zero fails on Rigor; at most one N/A-with-reason on Pillar outputs; zero fails on Draft shape. Drafts that don't meet this bar need another pass before posting.

## Anti-squatting: timing discipline

The draft is the skill's output, not the end of the process. The reporter typically holds the draft privately while starting the fix, then posts the issue and the PR close together. This reduces drive-by contributor squatting — scraping a public issue and rushing a PR before the reporter's.

Companion skill `give-back` carries drafts during this private-hold window. `/issue-forensics` produces the draft; `give-back` is the carrier. Neither automates the actual upstream submission — that stays a deliberate manual step.

**Precedence: responsible disclosure beats anti-squatting.** For security-shaped findings, **responsible disclosure takes precedence over anti-squatting timing.** If Phase 5.5 found a published disclosure path, follow it — do NOT post publicly first regardless of whether the PR is ready. Anti-squatting applies only to:

- Non-security findings, OR
- Security-shaped findings where Phase 5.5 surfaced no published disclosure policy after probing all four surfaces (`disclosure.chosen_path: public`).

The filename suffix from Phase 5.5 (`.private-draft.md` vs `.draft.md`) encodes which discipline applies; treat it as authoritative.
