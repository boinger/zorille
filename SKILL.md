---
name: codebase-audit
version: 1.6.0
description: |
  Full codebase audit. Analyzes an entire project cold, no diff, no branch context,
  producing a structured report covering bugs, security issues, architectural problems,
  tech debt, test gaps, and improvement opportunities. Read-only by default; --quick-fix auto-applies mechanical fixes.
  Use when asked to "audit this codebase", "codebase health", "tech debt assessment",
  "code quality review", "what's wrong with this code", or "analyze this codebase".
  NOT for reviewing a diff or PR.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - AskUserQuestion
---

## Voice

Be direct and concrete. Name the file, the function, the line number. Show the exact
command to run. When explaining a tradeoff, use real numbers. When something is broken,
point at the exact line.

No filler, no corporate tone, no academic hedging. Sound like a senior engineer writing
a postmortem: factual, specific, opinionated where it matters, honest about uncertainty.

If you're not sure about something, say so. "This looks like it could be X but I'd want
to verify by running Y" is better than a confident wrong answer.

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
SLUG=$(git remote get-url origin 2>/dev/null | sed 's/.*[:/]\([^/]*\/[^/]*\)\.git$/\1/' | tr '/' '-')
[ -z "$SLUG" ] && SLUG=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || basename "$(pwd)")
echo "SLUG: $SLUG"
AUDIT_HOME="${CODEBASE_AUDIT_HOME:-$HOME/.codebase-audits}"
echo "AUDIT_HOME: $AUDIT_HOME"
```

# /codebase-audit — Cold-Start Codebase Audit

Performs a full read-only audit of a codebase from scratch. No diff, no branch context — just the code as it exists right now. Produces a structured report with health score, findings by severity, and actionable recommendations.

You MUST NOT modify any source code. Your only Write operations are the report and baseline files in `$AUDIT_HOME`.

## Modes

Detect the mode from arguments:

- **Full** (default, no flags): Run all 4 phases. Produces a complete report. Typically 10-30 minutes depending on codebase size.
- **Quick** (`--quick`): Phase 1 only, plus the top 10 checklist patterns tagged `[QUICK]`. Produces a slim report: project profile, health score, top 5 findings. Target: under 2 minutes.
- **Regression** (automatic): If a previous `baseline.json` exists in `$AUDIT_HOME/$SLUG/audits/`, run the full audit and diff against the previous baseline. No flag needed — detected automatically.
- **Suggest Fixes** (`--suggest-fixes`): Adds a suggested code diff to each finding where a mechanical fix is possible. Mode compatibility:
  - Full: YES (default use case)
  - Regression: YES (runs full audit)
  - Quick: IGNORED (quick mode targets 2 minutes; generating diffs adds latency per finding)
  - Future focused modes (`--security-only` etc.): YES (applies to scanned subset)
  - CI mode (`--ci`): IGNORED (CI wants machine-readable PASS/FAIL, not diffs)
- **Quick Fix** (`--quick-fix`): Implies `--suggest-fixes`. Runs the full audit, then automatically applies all mechanical fixes tagged `[HIGH CONFIDENCE]` that meet quick-fix criteria (single file, <10 lines changed) in Phase 5. Mode compatibility:
  - Full: YES (default use case)
  - Regression: YES (runs full audit)
  - Quick: IGNORED (same rationale as `--suggest-fixes` — quick mode targets 2 minutes)
  - Future focused modes (`--security-only` etc.): YES (applies to scanned subset)
  - CI mode (`--ci`): IGNORED (CI wants pass/fail, not file modifications)
- **Changed Only** (`--changed-only [ref]`): Scopes the audit to files changed since a git ref. Default ref: merge base of current branch against the default branch. Skips Phase 2 (architecture scan) and does not write a baseline (partial audits would corrupt regression tracking). Mode compatibility:
  - Full flags (`--suggest-fixes`, `--quick-fix`): YES — applies to changed files
  - Quick: IGNORED (changed-only is already fast)
  - Regression: SKIP (no baseline to compare)
  - Non-git repo: ERROR (requires git)
- **CI** (`--ci`): Machine-readable output for CI/CD pipelines. Implies `--json`. Outputs JSON to stdout via single-quoted heredoc and progress to stderr. Exits with code 0 (pass) or 1 (fail) based on finding threshold. All interactive prompts are suppressed — AskUserQuestion is never called. Mode compatibility:
  - `--fail-on <level>`: Set fail threshold — `critical` (default) or `important`. Default: `critical`
  - `--fail-on-regression`: Also fail if health score decreased since last baseline
  - `--fail-on-new`: Fail only on NEW findings (not in previous baseline) at or above `--fail-on` threshold. No baseline → falls back to normal threshold. For legacy codebase onboarding
  - `--baseline-only`: Establish baseline for future regression tracking. Runs the full audit, writes baseline, always passes (exit 0). Use for CI onboarding on legacy codebases. Requires `--ci` or `--json`. Mutually exclusive with `--fail-on-new` and `--fail-on-regression`
  - `--changed-only`: YES — scoped CI check
  - `--quick`: YES — fast CI gate
  - `--suggest-fixes`: IGNORED, noted in `metadata.ignored_flags`
  - `--quick-fix`: IGNORED, noted in `metadata.ignored_flags`
- **JSON** (`--json`): Structured JSON output to stdout. Same format as `--ci` but without exit codes or fail thresholds. Status is always "pass". No plan file written. AskUserQuestion suppressed. Can be used standalone for dashboards, scripts, or tooling integration.
- **Severity Filter** (`--min-severity <level>`): Filters findings in output to only those at or above the specified severity: `critical`, `important`, or `notable`. Does NOT affect health score calculation (score always counts all findings). Applies to report, conversation summary, and CI JSON `findings` array.
- **Format** (`--format sarif`): SARIF 2.1.0 output for GitHub Code Scanning and compatible static analysis tools. Implies `--json` behavior (no interactive prompts, no plan file). Outputs SARIF to stdout and writes to `$AUDIT_HOME/$SLUG/audits/{dt}-results.sarif`. Mode compatibility:
  - `--ci`: YES — replaces JSON with SARIF, same exit code semantics
  - `--changed-only`: YES — scoped SARIF
  - `--min-severity`: YES — filtered results and rules arrays
  - `--quick`: YES
  - `--suggest-fixes` / `--quick-fix`: IGNORED
  - `--format json`: Default (implicit). Explicit `--format json` is accepted but no-op.
- **Infrastructure Scanning** (automatic): When infrastructure files are detected in Phase 1.2 (Dockerfiles, K8s manifests, Terraform, GitHub Actions, docker-compose, nginx configs), infrastructure patterns are loaded and scanned automatically as an 8th category. Use `--no-infra` to opt out. Infrastructure findings compete on severity with application findings for the 50-finding cap.

## Arguments

- `/codebase-audit` — full audit of the current project
- `/codebase-audit --quick` — quick smoke audit (2-min health check)
- `/codebase-audit --suggest-fixes` — full audit with inline fix diffs per finding
- `/codebase-audit --quick-fix` — full audit, then auto-apply high-confidence mechanical fixes
- `/codebase-audit --changed-only` — audit files changed since branch diverged from default branch
- `/codebase-audit --changed-only HEAD~5` — audit files changed in last 5 commits
- `/codebase-audit --changed-only main` — audit files changed vs main
- `/codebase-audit --ci` — CI mode: JSON output, exit code 0/1, no prompts
- `/codebase-audit --ci --fail-on critical` — CI mode, fail only on critical findings (default)
- `/codebase-audit --ci --fail-on important` — CI mode, fail on critical or important
- `/codebase-audit --ci --fail-on-regression` — also fail if score regressed
- `/codebase-audit --ci --fail-on-new` — fail only on new findings vs baseline
- `/codebase-audit --json` — JSON output without CI exit-code behavior
- `/codebase-audit --min-severity important` — show only important+ findings
- `/codebase-audit --format sarif` — SARIF 2.1.0 output for GitHub Code Scanning
- `/codebase-audit --ci --format sarif` — CI mode with SARIF output
- `/codebase-audit --ci --format sarif --changed-only` — scoped CI check with SARIF
- `/codebase-audit --ci --baseline-only` — establish baseline, always passes (for CI onboarding)
- `/codebase-audit --no-infra` — skip infrastructure scanning even if infra files are present

---

## Phase 1: Orientation

Goal: understand what this project is, how big it is, what it's built with, and its recent health signals.

### 1.1 Project identity

The project slug was resolved in the preamble. Print it for reference:

```bash
echo "Project: $SLUG"
echo "Audit storage: $AUDIT_HOME/$SLUG/audits/"
```

### 1.2 Language and framework detection

Scan for build files, configs, and entry points to detect the tech stack:

```bash
setopt +o nomatch 2>/dev/null || true
ls -la package.json Cargo.toml go.mod pyproject.toml Gemfile build.gradle pom.xml Makefile CMakeLists.txt *.csproj *.sln composer.json mix.exs 2>/dev/null || true
```

Also scan for infrastructure config files:

```bash
setopt +o nomatch 2>/dev/null || true
ls -la Dockerfile docker-compose.yml docker-compose.yaml nginx.conf 2>/dev/null || true
ls -la .github/workflows/*.yml .github/workflows/*.yaml 2>/dev/null || true
find . -maxdepth 3 \( -name '*.tf' -o -name '*.tfvars' \) -not -path '*/node_modules/*' -not -path '*/vendor/*' -not -path '*/.git/*' 2>/dev/null | head -5 || true
find . -maxdepth 3 \( -path '*/k8s/*.yaml' -o -path '*/k8s/*.yml' -o -path '*/deploy/*.yaml' -o -path '*/deploy/*.yml' -o -name 'Chart.yaml' \) -not -path '*/node_modules/*' -not -path '*/vendor/*' -not -path '*/.git/*' 2>/dev/null | head -5 || true
```

If any infrastructure files are found, note "Infrastructure files detected" for use in Phase 3.1 (auto-loading the infra checklist). This detection is informational — the `--no-infra` flag controls whether infra patterns actually run.

Read whichever build/config files exist to determine: primary language, framework, build tool, test runner, package manager.

### 1.3 Codebase stats

Count lines of code, excluding vendored and build directories:

```bash
find . -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.py' -o -name '*.rb' -o -name '*.go' -o -name '*.rs' -o -name '*.java' -o -name '*.cs' -o -name '*.cpp' -o -name '*.c' -o -name '*.h' -o -name '*.swift' -o -name '*.kt' -o -name '*.php' -o -name '*.sh' -o -name '*.bash' -o -name '*.zsh' -o -name '*.vue' -o -name '*.svelte' \) -not -path '*/node_modules/*' -not -path '*/vendor/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/.next/*' -not -path '*/target/*' -not -path '*/__pycache__/*' -not -path '*/venv/*' | head -5000 | xargs wc -l 2>/dev/null | tail -1
```

This counts source code files only. If `cloc` is available, prefer it for a more accurate breakdown by language.

Classify the codebase size:
- **Small**: <10K LOC
- **Medium**: 10K–50K LOC
- **Large**: >50K LOC

### 1.4 Read orientation docs

Read these files if they exist: `README.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`. Skip any that don't exist — do not error.

### 1.5 Git state

If this is a git repo, gather recent activity:

```bash
git log --oneline -10
git log --format='%aN' | sort | uniq -c | sort -rn | head -10
```

If this is not a git repo, note that and skip all git-dependent steps gracefully.

### 1.6 Git churn analysis

Identify hotspot files (most frequently changed in the last 90 days):

```bash
git log --since=90.days --name-only --format="" | sort | uniq -c | sort -rn | head -20
```

Estimate bus factor for the top 5 hotspot files — how many unique authors have touched each:

```bash
git log --format='%aN' -- <file> | sort -u | wc -l
```

Skip this step if the repo is not a git repo or is a shallow clone.

### 1.7 Dependency vulnerability check

Detect the package manager and run the appropriate audit command if available:

- **npm/yarn**: `npm audit --json 2>/dev/null`
- **Ruby**: `bundle audit --format json 2>/dev/null`
- **Python**: `pip-audit --format json 2>/dev/null`
- **Rust**: `cargo audit --json 2>/dev/null`
- **Go**: `govulncheck ./... 2>/dev/null`

If the audit tool is not installed or the command fails, skip gracefully and note "dependency audit tool not available" in the report.

### 1.8 Size-based strategy decision

Based on codebase size from step 1.3:
- **Small** (<10K LOC): Read everything. Full coverage is feasible.
- **Medium** (10K–50K LOC): Read high-risk files fully (entry points, auth, payment, data access, configs). Sample the rest using Grep pattern matches.
- **Large** (>50K LOC): Use AskUserQuestion to ask the user which areas to focus on. Suggest the top 3 areas based on churn hotspots and framework-specific risk areas. Do not proceed until the user responds. If `--ci` or `--json` is active, use the Medium strategy automatically instead — do not use AskUserQuestion. CI/JSON mode must be non-interactive.

If in quick mode, stop after this phase. Jump to the Phase 3 quick-mode subset (top 10 `[QUICK]` patterns only), then skip to Phase 4 for the slim report.

### 1.9 Changed-only file resolution

Skip this step unless `--changed-only` is active. This step requires git — if not a git repo, error: "`--changed-only` requires a git repository" and stop.

**Resolve the git ref:**

If the user provided an explicit ref (e.g., `--changed-only main`, `--changed-only HEAD~5`):

```bash
git rev-parse --verify <ref> 2>/dev/null
```

If invalid, error: "Invalid git ref: `<ref>`" and stop.

If no explicit ref (bare `--changed-only`):

```bash
DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | sed 's/.*: //')
[ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH="main"
MERGE_BASE=$(git merge-base HEAD "$DEFAULT_BRANCH" 2>/dev/null)
```

If merge-base fails (e.g., no common ancestor, already on the default branch with no divergence), error and stop.

**Get the changed file list:**

```bash
git diff --name-only --diff-filter=ACMR $REF...HEAD
```

`--diff-filter=ACMR` includes Added, Copied, Modified, and Renamed files. Deleted files are excluded (nothing to audit). Renamed files appear by their new name only, which is correct for auditing current state. Binary files may appear in the list — Grep will silently skip them, which is expected.

If the list is empty: print "No files changed since `{ref}`. Nothing to audit." and exit gracefully.

Print: "Auditing N files changed since `{ref}`"

Store the file list for use in Phase 3. Skip Phase 1.8 (size-based strategy) — the scope is already defined by the changed file list.

---

## Phase 2: Architecture Scan

Skip this phase entirely in quick mode or if `--changed-only` is active (architecture scan is not meaningful for a scoped file set).

### 2.1 Map entry points and boundaries

Read the main entry points: app bootstrap files, routers, API handlers, CLI entry points. Identify:
- What the application does (web server, CLI, library, service, monorepo)
- Major components and their boundaries
- External dependencies and integrations (databases, APIs, queues, caches)
- Data flow: how requests/data enter, transform, and exit

### 2.2 Identify layers

Map the architectural layers: presentation, business logic, data access, infrastructure. Note which layers exist and which are missing or blurred.

### 2.3 Configuration and environment

Read configuration files, environment variable usage, and secrets management. Look for:
- Hardcoded credentials or secrets
- Environment-specific configuration
- Feature flags
- Build/deploy configuration

### 2.4 Output architecture diagram

Produce an ASCII architecture diagram showing components, their relationships, data flow, and external dependencies. Keep it to 20-30 lines maximum. This goes in the report.

---

## Phase 3: Targeted Deep Dives

In quick mode, run only the top 10 patterns tagged `[QUICK]` from the checklist, then skip to Phase 4.

In full mode, run the complete checklist.

### 3.1 Load checklists

Use the **Read tool** (not Bash cat) to load the primary checklist:

`~/.claude/skills/codebase-audit/checklist.md`

If the checklist file is unreadable or missing, STOP and report an error: "Audit checklist not found at ~/.claude/skills/codebase-audit/checklist.md — cannot continue." Do not proceed without it.

Then use the **Read tool** to load the supplemental patterns reference:

`~/.claude/skills/codebase-audit/references/patterns.md`

If infrastructure files were detected in Phase 1.2 and `--no-infra` is NOT active, also load the infrastructure checklist:

`~/.claude/skills/codebase-audit/references/infra-checklist.md`

If the infra checklist file is unreadable or missing, WARN: "Infrastructure checklist not found — skipping infra patterns. Run setup to install." Continue the audit without infra patterns (do not stop). If no infra files were detected in Phase 1.2, skip loading the infra checklist entirely.

### 3.2 Load custom checklist

If the target project contains `.codebase-audit/checklist.md`, read it and append its items to the built-in checklist. Built-in patterns run first, custom additions run second. This allows projects to define custom audit rules.

### 3.3 Execute checklist

Work through the checklist in priority order:

1. **Security** — injection, auth bypass, secrets exposure, SSRF, path traversal
2. **Correctness** — logic errors, race conditions, null safety, error handling
3. **Reliability** — crash paths, resource leaks, timeout handling, retry logic
4. **Tests** — coverage gaps, test quality, missing edge cases, flaky patterns
5. **Architecture** — coupling, abstraction leaks, circular dependencies, god classes
6. **Tech Debt** — dead code, TODO/FIXME/HACK comments, deprecated APIs, copy-paste
7. **Performance** — N+1 queries, unbounded collections, missing indexes, large payloads
8. **Infrastructure** (if infra files detected and `--no-infra` not active) — Docker, Kubernetes, Terraform, CI/CD, nginx misconfigurations

For each checklist item: use Grep in `files_with_matches` mode (not `content` mode) to find which files match, then use Read to examine the specific lines for confirmation. Do not dump entire file contents into the conversation — use targeted reads of specific line ranges. Do not report a pattern match as a finding without reading the context — many patterns have legitimate uses.

**If `--changed-only` is active:** Scope Grep to only the changed files from Phase 1.9.

- **≤20 changed files**: Pass each file path to Grep's `path` parameter individually.
- **>20 changed files**: Run Grep on the full codebase as normal, then filter results to only include files in the changed-only list. This avoids thousands of individual Grep calls.

Binary files in the changed list will be silently skipped by Grep — this is expected and correct. Renamed files appear by their new name only.

**Important:** Keep the conversation output concise. For checklist execution, use `files_with_matches` to identify candidate files, then Read specific line ranges. Never let a single Grep call return hundreds of lines of content into the conversation.

**If `--suggest-fixes` is active:** After confirming each finding via Read and before moving to the next checklist item, generate a suggested fix diff. Follow these rules:

1. **Minimal change only.** Show the smallest diff that addresses the finding. Do not refactor, rename, or restructure surrounding code.
2. **Unified diff format.** Use standard unified diff notation: `--- a/path`, `+++ b/path`, `@@ -LINE,COUNT +LINE,COUNT @@`.
3. **Target 5-10 lines per diff.** If the minimal fix genuinely requires more, show the full fix but note it as a larger change. Never truncate a diff mid-fix.
4. **Repeated patterns.** Show up to 3 representative diffs if the fix pattern varies across locations, then list remaining locations grouped by which pattern applies. For homogeneous patterns, show the fix once and list other locations.
5. **Unfixable findings.** If a finding cannot be fixed with a code diff (missing tests, architectural coupling, design decisions needed), do NOT generate a diff. Instead mark: `**Suggested Fix:** Requires design decision — see fix plan Part 2.` or `**Suggested Fix:** Requires implementation — no single-file fix exists.`
6. **Classification alignment.** Mechanical findings always get diffs. Substantive findings get a diff ONLY if there is an obvious first step. Otherwise, mark as requiring design decision.
7. **Confidence tag.** Mark each diff as `[HIGH CONFIDENCE]` (deterministic fix — removing hardcoded secret, adding timeout, narrowing exception type) or `[REVIEW SUGGESTED]` (best-guess fix — choosing validation approach, error type selection, refactoring pattern).
8. **Non-source files.** Do NOT generate diffs for findings in vendored (`node_modules`, `vendor`), generated (`dist`, `build`), or binary files. Instead note: "Fix upstream in [package]" or "Fix in [generator source]."

### 3.4 Finding limits

Cap detailed findings at 50. If more than 50 findings are identified, keep the top 50 by severity and provide a summary table for the rest (category, count, example file).

### 3.5 Finding format

Every finding MUST include:
- **Severity**: Critical, Important, Worth noting, or Opportunity
- **Category**: Security, Correctness, Reliability, Tests, Architecture, Tech Debt, Performance, or Infrastructure
- **Title**: One-line description
- **Location**: `file:line` for code findings. For non-code findings (missing tests, dependency vulnerabilities, architectural patterns), reference the most relevant file or component.
- **Evidence**: The specific code or pattern found
- **Recommendation**: What to do about it
- **Suggested Fix** (if `--suggest-fixes`): Unified diff showing the minimal code change with confidence tag (`[HIGH CONFIDENCE]` or `[REVIEW SUGGESTED]`), OR "Requires design decision" / "Requires implementation" for findings without a clear mechanical fix.

No hallucinating findings. Every finding must reference a specific file and line (or component for non-code findings). If you cannot point to it in the codebase, do not report it.

### 3.6 Severity calibration

Use these exact definitions:

- **Critical**: Exploitable security vulnerability, data loss risk, correctness bug that produces wrong results in production. Would block a release.
- **Important**: Significant reliability risk, missing error handling on critical paths, test gaps on core business logic, architectural problems that will compound. Worth scheduling promptly.
- **Worth noting**: Code smells, minor tech debt, style inconsistencies, non-critical performance issues. Address during normal development when touching nearby code.
- **Opportunity**: Not a problem — a concrete improvement that would make the codebase better. New patterns, better abstractions, tooling upgrades.

---

## Phase 4: Report Generation

### 4.0 Report and plan — two outputs

The audit produces **two artifacts**:

1. **Report + baseline** — written to `$AUDIT_HOME/$SLUG/audits/` via Bash heredoc (permanent record, not actionable by Claude Code)
2. **Fix plan** — written to the plan file (actionable — this is what "Ready to code?" executes)

The audit is planning-for-a-plan. The report is the research; the plan file is the actionable output. This is compatible with plan mode — the audit phases (1-3) are read-only research, and Phase 4 produces both the archival report and the executable fix plan.

**Always use Bash heredoc** to write the report and baseline to `$AUDIT_HOME` — the Write tool may be restricted to the plan file in plan mode.

### 4.1 Load report template

Use the **Read tool** to load the report template:

`~/.claude/skills/codebase-audit/report-template.md`

Use this template to structure the final report. If the template is missing, use the structure described below as a fallback.

### 4.2 Calculate health score

Start at 100 and deduct per finding:
- Critical: -25 points each
- Important: -10 points each
- Worth noting: -3 points each
- Opportunity: no deduction

Floor at 0. No score exceeds 100. The model is deliberately simple — use regression mode to track relative improvement rather than fixating on the absolute number.

### 4.3 Write the report

Create the output directory using the slug from the preamble:

```bash
mkdir -p "$AUDIT_HOME/$SLUG/audits"
```

Generate a datetime stamp and write the report to `$AUDIT_HOME/$SLUG/audits/{datetime}-audit.md`. Use format `YYYY-MM-DD-HHMMSS` for the datetime (e.g., `2026-03-20-143022`).

The report should contain:
1. **Header**: Project name, date, mode, health score
2. **Executive Summary**: 3-5 sentence overview of codebase health
3. **Project Profile**: Language, framework, size, test coverage estimate, git activity
4. **Architecture Diagram**: ASCII diagram from Phase 2 (skip in quick mode)
5. **Findings by Severity**: Grouped by severity, then by category within each severity level
6. **Dependency Vulnerabilities**: Summary from Phase 1 CVE check (if any found)
7. **Churn Hotspots**: Top files by change frequency and bus factor
8. **Summary Table**: Category x severity matrix with counts
9. **Top 5 Priorities**: The 5 most impactful things to fix, in order
10. **Recommendations**: Strategic suggestions beyond individual findings

For quick mode, the slim report contains only: Header, Executive Summary, Project Profile, Health Score, Top 5 Findings.

For `--changed-only` mode, add a **Scope** section after the Header showing the ref, file count, and file list. Include a note: "This is a scoped audit. Only changed files were analyzed. Run a full `/codebase-audit` for complete coverage." Skip Architecture Diagram and Churn Hotspots.

### 4.4 Write baseline JSON

Skip baseline generation if `--changed-only` is active. Partial audit baselines would corrupt regression tracking against full audits.

Write a companion `{datetime}-baseline.json` file in the same directory. This is used for regression comparison on future runs.

Schema:

```json
{
  "version": "1.0.0",
  "datetime": "2026-03-20T14:30:22Z",
  "mode": "full",
  "slug": "org-project",
  "health_score": 72,
  "quick_fix_applied": false,
  "codebase": {
    "loc": 24500,
    "languages": ["TypeScript", "Python"],
    "framework": "Next.js",
    "test_files": 47,
    "dependency_vulns": 3
  },
  "findings": [
    {
      "id": "<sha256 hash of file + category + title>",
      "severity": "critical",
      "category": "security",
      "title": "SQL injection in user search",
      "file": "src/api/users.ts",
      "line": 42,
      "has_suggested_fix": true,
      "quick_fix_status": "applied"
    }
  ],
  "summary": {
    "critical": 1,
    "important": 5,
    "notable": 12,
    "opportunity": 8,
    "total": 26
  }
}
```

The `has_suggested_fix` field is present when `--suggest-fixes` was used. The `quick_fix_status` field is present when `--quick-fix` was used — values are `"applied"`, `"skipped"`, or omitted. The `quick_fix_applied` top-level field is `true` when `--quick-fix` was active. Omit all these fields when the corresponding flag was not used — old baselines won't have them, and consumers should treat missing fields as `false`/`null`. The finding ID hash does NOT include these fields (it's based on `file:category:title` only), so adding or removing fix suggestions or quick-fix status doesn't change finding identity for regression tracking.

Each finding gets a deterministic content-based ID for stable regression comparison. Compute it as:

```bash
echo -n "file:category:title" | shasum -a 256 | cut -d' ' -f1
```

For example: `echo -n "browse/src/write-commands.ts:security:Missing path validation on upload" | shasum -a 256 | cut -d' ' -f1`

Run this for each finding and use the resulting hash as the `id` field. This ensures findings match across runs even if their order changes.

### 4.5 Regression comparison

Skip regression comparison if `--changed-only` is active (no baseline was written).

If a previous `baseline.json` exists in the same audits directory AND the current mode is full (not quick, not changed-only):

1. Load the most recent previous baseline
2. Compare findings by their content-based IDs
3. Compute:
   - **Fixed**: findings in previous baseline not present in current run
   - **New**: findings in current run not present in previous baseline
   - **Persistent**: findings present in both
   - **Score delta**: current score minus previous score
4. Add a "Regression Summary" section to the report showing these deltas

If no previous baseline exists, skip regression comparison.

### 4.6 Conversation summary

If `--ci`, `--json`, or `--format sarif` is active, replace the human-readable conversation summary with structured output construction. Progress messages during Phases 1-3 go to stderr (`echo '...' >&2`). The output is NOT emitted here — data is assembled for Phase 4.8. If `--format sarif` is active, data is assembled for SARIF emission instead of JSON. If `--min-severity` is active, filter the findings array and conversation summary to only include findings at or above the specified severity level.

Otherwise, print a summary directly to the conversation. This is what the user sees immediately:

1. **Health Score**: The number and a one-line interpretation (e.g., "72/100 — solid foundation with some important gaps")
2. **Executive Summary**: 3-5 sentences
3. **Top 5 Priorities**: Numbered list with severity, title, and file reference
4. **Summary Table**: Category x severity counts
5. **Report location**: Full path to the written report
6. **Regression delta** (if applicable): Score change, count of fixed/new findings
7. **Fix Coverage** (if `--suggest-fixes`): "N of M findings have suggested fixes (X%)" — gives instant signal on how actionable the audit is
8. **Quick Fix Preview** (if `--quick-fix`): "N fixes will be auto-applied in Phase 5 (M skipped: K review-suggested, J multi-file, L too large)" — tells the user what Phase 5 will do before it runs
9. **Scope** (if `--changed-only`): "Audited N files changed since {ref}" — reminds the user this was a scoped audit
10. **Tips** — consolidated block at the end of the summary. Each tip fires at most once per audit. Only include tips that are relevant:
    - If neither `--suggest-fixes` nor `--quick-fix` was used and there are findings: "Run with `--suggest-fixes` for inline fix diffs, or `--quick-fix` to auto-apply the safe ones."
    - If `--suggest-fixes` was used but `--quick-fix` was NOT, and there are `[HIGH CONFIDENCE]` single-file findings: "N of these findings could be auto-applied with `/codebase-audit --quick-fix`"
    - If this is a full audit (not `--changed-only`), on a non-default branch, with >20 findings: "Use `--changed-only` to audit only files changed on this branch."
    - If `--no-infra` was used but infrastructure files were detected: "Infrastructure files detected but scanning was disabled via `--no-infra`."
    - If `--ci` is active and no previous baseline exists and `--baseline-only` is NOT active: "First CI run on this codebase. Use `--baseline-only` to establish a baseline without failing, then `--fail-on-new` for ongoing runs."
    - If no tips are applicable, omit the Tips block entirely.

### 4.7 Write the Fix Plan

Skip this phase if `--ci` is active (no plan file). In `--json` mode without `--ci`, also skip the plan file. AskUserQuestion is never called in `--ci` or `--json` mode.

After printing the conversation summary, write the fix plan to the plan file. The audit is planning-for-a-plan — the plan file is the natural, actionable output.

**Classify each finding:**
- **Mechanical** (gitignore patterns, narrowing exception types, adding timeouts, adding inline auth checks, replacing assert with explicit checks — things with zero design judgment, single-file changes)
- **Substantive** (architecture changes, error handling redesign across many files, test coverage additions, security pattern changes — things requiring design decisions or touching 3+ files)

**Structure the plan file with two parts:**

```markdown
> **Recommended workflow:**
> 1. Accept this plan to apply Part 1 (mechanical fixes) immediately
> 2. Then review Part 2 (substantive fixes) before implementing
>
> Or accept the full plan to implement everything in one session.

# Codebase Audit Fix Plan

## Context
{audit summary, score, commit}

## Part 1: Mechanical Fixes (apply immediately)

### Part 1a: High Confidence (apply directly)
{Findings tagged [HIGH CONFIDENCE] — deterministic, safe to apply without review}
{Each entry includes: file, problem, suggested diff (if --suggest-fixes), verify}

### Part 1b: Review Suggested Fix
{Findings tagged [REVIEW SUGGESTED] — best-guess, review the diff before applying}
{Each entry includes: file, problem, suggested diff (if --suggest-fixes), alternatives note, verify}

{If --suggest-fixes was NOT used, omit the 1a/1b split — use a flat list as before}

## Part 2: Substantive Fixes (review first)

> These fixes touch multiple files and benefit from architectural review.

{For each substantive finding: scope, approach, files to modify, verification}
```

**If there are no substantive findings** (all mechanical), omit Part 2 entirely.

**If there are no findings worth fixing** (all Notable/Opportunity), write a minimal plan:
```markdown
# Codebase Audit — No Action Required

Health score: {N}/100. No critical or important findings.
See full report at $AUDIT_HOME/{slug}/audits/{datetime}-audit.md
```

**If `--quick-fix` is active:** Mark Part 1a findings (HIGH CONFIDENCE, single-file, <10 lines) with `[AUTO-APPLYING]` prefix in the plan. These still appear for documentation, but Phase 5 will apply them automatically. The plan's recommended workflow becomes:

> **Recommended workflow:**
> 1. Phase 5 will auto-apply Part 1a (high-confidence mechanical fixes)
> 2. Review Part 1b (review-suggested fixes) and apply manually
> 3. Then review Part 2 (substantive fixes) before implementing

If all findings are auto-applying (no Part 1b or Part 2), the plan says: "All fixes will be applied by --quick-fix. No further manual action needed."

Skip the AskUserQuestion in Phase 4.7 when `--quick-fix` is active — the user already opted into auto-application by passing the flag. Proceed directly to Phase 5.

**If `--quick-fix` is NOT active**, use AskUserQuestion to offer the next step:

If there are substantive findings (Part 2 exists):

> "Audit complete. Plan written with {M} mechanical fixes (Part 1) and {S} substantive fixes (Part 2). The mechanical fixes are ready to apply. The substantive fixes benefit from review before implementation."

Options:
- **A) Accept the plan as-is** — apply all fixes
- **B) I want to make changes first** — edit the plan before proceeding

If there are only mechanical findings (no Part 2):

> "Audit complete. Plan written with {M} mechanical fixes — all straightforward."

Options:
- **A) Apply fixes now** (recommended)
- **B) I want to review the plan first**

### 4.8 Structured output

Skip unless `--ci`, `--json`, or `--format sarif` is active.

If `--format` is specified with an unsupported value (anything other than `json` or `sarif`), error: "Unsupported format: `{value}`. Supported formats: `json`, `sarif`." and stop.

If `--baseline-only` is used without `--ci` or `--json`, error: "`--baseline-only` requires `--ci` or `--json` mode." and stop.

If `--baseline-only` is used with `--fail-on-new`, error: "Cannot use `--baseline-only` with `--fail-on-new`. Use `--baseline-only` for the first run, then `--fail-on-new` for subsequent runs." and stop.

If `--baseline-only` is used with `--fail-on-regression`, error: "Cannot use `--baseline-only` with `--fail-on-regression`. `--baseline-only` always passes." and stop.

#### 4.8.1 Build output data from baseline

Read the baseline written in Phase 4.4 and augment with output-specific fields:
- `status`: "pass" or "fail" (always "pass" for `--json` or `--format sarif` without `--ci`, always "pass" for `--baseline-only`)
- `threshold`: the `--fail-on` level (default: "critical")
- `findings_above_threshold`: count of findings at or above threshold
- `findings_count`: total findings count (for truncation detection)
- `metadata.schema_version`: "1.0"
- `metadata.tool_version`: read from VERSION file
- `metadata.duration_seconds`: elapsed time since audit start
- `metadata.mode`: "ci", "json", or "sarif"
- `metadata.baseline_only`: `true` if `--baseline-only` is active (omit otherwise). Lets consumers distinguish "passed because clean" from "passed because baseline mode."
- `metadata.flags`: array of invocation flags used
- `metadata.ignored_flags`: array of suppressed flags (e.g., `--suggest-fixes` in CI mode)

If `--min-severity` is active, filter the `findings` array to only include findings at or above the specified severity. `findings_count` reflects the filtered count. Health score and `summary` are NOT filtered (they reflect full audit). Note: this means `summary.total` and `findings_count` may differ when `--min-severity` is used — this is intentional (`summary` = full audit picture, `findings` array = filtered view).

#### 4.8.2 Determine pass/fail

If `--baseline-only` is active, skip pass/fail determination. Set `status` to `"pass"` unconditionally.

Skip for `--json` or `--format sarif` without `--ci`.

1. Count findings at or above the `--fail-on` threshold (default: `critical`)
   - `--fail-on critical`: fail if any critical findings
   - `--fail-on important`: fail if any critical or important findings
2. If `--fail-on-regression` and a previous baseline exists: also fail if `health_score` decreased
3. If `--fail-on-new` and a previous baseline exists: count only findings whose IDs are NOT in the previous baseline. Fail if any new findings at or above `--fail-on` threshold. No baseline → fall back to normal threshold.
4. Set `status` to `"pass"` or `"fail"`

#### 4.8.3 Emit output

**If `--format sarif` is active:**

Construct a SARIF 2.1.0 document. Follow this structure exactly:

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "codebase-audit",
          "semanticVersion": "{tool_version}",
          "informationUri": "https://github.com/boinger/codebase-audit",
          "rules": [
            {
              "id": "{category}/{kebab-title}",
              "shortDescription": { "text": "{finding title}" },
              "fullDescription": { "text": "{recommendation}" },
              "defaultConfiguration": { "level": "{error|warning|note}" },
              "properties": { "security-severity": "{9.0|7.0|4.0|1.0}" }
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "{category}/{kebab-title}",
          "level": "{error|warning|note}",
          "message": { "text": "{finding title}" },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "{relative/file/path}",
                  "uriBaseId": "%SRCROOT%"
                },
                "region": { "startLine": "{line_number}" }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Rule ID construction:** For each finding, construct the rule ID as `{category}/{kebab-title}`:
- `category`: lowercase finding category (`security`, `correctness`, `reliability`, `architecture`, `tests`, `tech-debt`, `performance`, `infrastructure`)
- `kebab-title`: finding title lowercased, spaces and special characters replaced by hyphens, consecutive hyphens collapsed
- Example: category "Security", title "Hardcoded secrets" → `security/hardcoded-secrets`
- Example: category "Tech Debt", title "TODO/FIXME/HACK markers" → `tech-debt/todo-fixme-hack-markers`

**Rules deduplication:** Multiple findings may share the same rule ID (e.g., two "empty catch blocks" in different files). Declare each unique rule ID exactly once in `tool.driver.rules[]`. Each finding becomes a separate entry in `results[]`.

**Message structure:** `message.text` contains the finding title only (renders inline on code in GitHub). The recommendation goes in `rule.fullDescription.text` (visible when clicking through to finding detail). This keeps inline annotations clean.

**Severity mapping:**

| Audit severity | SARIF `level` | `security-severity` |
|---|---|---|
| Critical | `"error"` | `"9.0"` |
| Important | `"warning"` | `"7.0"` |
| Worth noting | `"note"` | `"4.0"` |
| Opportunity | `"note"` | `"1.0"` |

**File path normalization:** All `uri` values must be relative to the repository root with forward slashes only and no leading `./`. Compute the git root:

```bash
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
```

Strip the git root prefix from each finding's file path. If not a git repo, paths are relative to `pwd`.

**Non-file findings:** Findings that reference components or patterns rather than specific files (e.g., "missing integration tests") should use the most relevant file as the location. If no file is applicable, omit the `locations` array for that result — SARIF permits results without locations, though GitHub renders these less usefully.

**If `--min-severity` is active:** Filter both the `results` array and the `rules` array. Only include rules that are referenced by at least one included result.

**Emit SARIF** via single-quoted heredoc to prevent shell expansion:

```bash
cat <<'EOF'
{ ... the SARIF JSON ... }
EOF
```

**Write SARIF to file:** `$AUDIT_HOME/$SLUG/audits/{dt}-results.sarif`

Upload to GitHub Code Scanning with: `github/codeql-action/upload-sarif@v3`

**Otherwise (default JSON format):**

Emit JSON via single-quoted heredoc to prevent shell expansion:

```bash
cat <<'EOF'
{ ... the JSON ... }
EOF
```

Write JSON to file: `$AUDIT_HOME/$SLUG/audits/{dt}-ci-output.json`

#### 4.8.4 Exit

If `--baseline-only` is active, always `exit 0` regardless of findings.

`--ci` only — skip for `--json` or `--format sarif` without `--ci`:

```bash
exit 0  # pass
```

or:

```bash
exit 1  # fail
```

CI consumers SHOULD parse the JSON `status` field (or SARIF results) as the primary signal. The `exit 0`/`exit 1` from the Bash block is a convenience — it exits the Bash subprocess, not the Claude Code session, and may not propagate to the CI runner's exit code depending on how Claude Code is invoked.

Do not proceed to Phase 5 in `--ci` mode.

---

## Phase 5: Quick Fix Application

Skip this phase entirely unless `--quick-fix` is active. Also skip if `--ci` is active (CI mode should not modify source code). This phase modifies source code.

### 5.1 Check preconditions

Before modifying any files, check the working tree:

```bash
git status --porcelain 2>/dev/null
```

If the output is non-empty (uncommitted changes exist), use AskUserQuestion:

> "Working tree has uncommitted changes. Quick-fix modifications will be mixed with existing changes."

Options:
- **A) Proceed anyway** — apply fixes alongside existing changes
- **B) Abort Phase 5** — skip fix application, keep the report and plan as-is

If this is not a git repo, skip this check and proceed (commit proposal in 5.4 will also be skipped).

### 5.2 Collect eligible fixes

From the findings generated in Phase 3, collect all fixes that meet ALL of these criteria:

1. Tagged `[HIGH CONFIDENCE]`
2. Single file change (diff touches exactly one file)
3. Less than 10 lines changed (sum of added + removed lines in the unified diff)
4. File is not vendored (`node_modules/`, `vendor/`, `.git/`), generated (`dist/`, `build/`), or binary
5. File still exists at the path referenced in the diff

Fixes that fail any criterion are **skipped**. Track each skipped fix and its skip reason (e.g., "review-suggested", "multi-file", "too large", "file not found").

If zero fixes are eligible, print "No fixes met quick-fix criteria. All findings require manual review — see the fix plan." and skip to Phase 5.5.

### 5.3 Apply fixes

For each eligible fix, in the order they appeared in the findings:

1. **Read the target file fresh.** Do NOT rely on line numbers from Phase 3 — earlier fixes in Phase 5 may have shifted them. Use the Edit tool's `old_string` matching to locate the correct position.
2. **Verify context.** The diff's context lines (unchanged lines surrounding the change) and `-` lines (lines to be removed/replaced) must match the current file content exactly.
3. **If context matches:** Apply the fix using the Edit tool. Use the `-` lines as `old_string` and the `+` lines as `new_string`, with enough surrounding context to ensure a unique match.
4. **If context does NOT match:** Skip the fix and record reason: "file content changed since audit" or "conflict with earlier fix in same file."

**Important:**
- Apply one fix at a time. If a fix fails to apply, skip it and continue with the remaining fixes. Do not abort Phase 5 because one fix failed.
- For multiple fixes in the same file: after applying each fix, re-Read the file before attempting the next. Line numbers from Phase 3 are stale after any modification.
- Never modify anything beyond the exact change described in the diff. No cleanup, no reformatting, no adjacent improvements.

### 5.4 Stage and propose commit

If at least one fix was applied and this is a git repo:

1. Stage only the specific files modified by quick-fix:
   ```bash
   git add <file1> <file2> ...
   ```
   Do NOT use `git add -A` or `git add .`.

2. Print the quick-fix summary:
   - **Applied** (N fixes): list each with file path, finding title, and one-line description of the change
   - **Skipped** (M fixes): list each with file path, finding title, and skip reason

3. Print the proposed commit message:
   ```
   fix: apply N mechanical fixes from codebase audit

   - <finding title> (file)
   - <finding title> (file)
   ...
   ```

4. Use AskUserQuestion:
   > "N mechanical fixes applied and staged."

   Options:
   - **A) Commit with this message**
   - **B) Commit with a different message**
   - **C) Keep staged, don't commit** (user will commit manually)
   - **D) Unstage everything** (user wants to review further)

5. Execute the user's choice:
   - A: Create the commit with the proposed message.
   - B: Ask for the message, then create the commit.
   - C: Do nothing further.
   - D: Run `git reset HEAD <files>` to unstage.

If this is not a git repo, skip this step entirely — just print the applied/skipped summary.

### 5.5 Final summary

Print:
- "Quick-fix complete. N fixes applied, M skipped."
- "Recommend running your test suite to verify: `{detected test command}`" — detect the test command from `package.json` scripts, `Makefile`, or equivalent.
- If remaining plan items exist (Part 1b or Part 2): "The fix plan still contains K items requiring manual review."
- Report location reminder.

---

## Edge Cases

- **Empty or binary-only project**: If the codebase has fewer than 10 text files or fewer than 100 LOC, write a brief report noting this and exit gracefully. Do not force findings.
- **Not a git repo**: Skip all git-dependent steps (churn analysis, bus factor, recent activity). Note in the report that git history was unavailable.
- **Zero findings**: If the audit produces zero findings, note this in the report with a caveat: "Zero findings is unusual — this may indicate the checklist patterns don't match this tech stack. Consider running with a custom checklist."
- **500+ raw pattern matches**: If Grep returns an overwhelming number of matches for a pattern, sample the first 20 and note the total count. Do not read all 500+.
- **Large codebase scoping**: For codebases >50K LOC, AskUserQuestion fires in Phase 1 to scope the audit. Do not attempt to read the entire codebase.
- **Missing checklist**: If the checklist file at `~/.claude/skills/codebase-audit/checklist.md` is unreadable, STOP with an error message. The audit cannot run without it.
- **Network failures**: If dependency audit commands fail due to network issues, skip gracefully and note the skip in the report.
- **`--suggest-fixes` with `--quick`**: Ignore the `--suggest-fixes` flag and note in the report: "Fix suggestions are not available in quick mode — run a full audit with `--suggest-fixes` for inline diffs." Quick mode targets a 2-minute time budget; diff generation adds latency per finding.
- **Ambiguous fixes**: When multiple valid fix approaches exist (e.g., "add input validation" could mean regex, schema validation, or type checking), show the simplest approach and note: "Alternative approaches exist — see Recommendation."
- **`--quick-fix` with `--quick`**: Ignore the `--quick-fix` flag and note in the report: "Quick-fix is not available in quick mode — run a full audit with `--quick-fix` for auto-applied fixes."
- **`--quick-fix` with zero eligible fixes**: All fixes were skipped (review-suggested, multi-file, too large, or stale). Print summary explaining why each was skipped and direct the user to the fix plan.
- **`--quick-fix` on a dirty working tree**: Phase 5.1 checks `git status --porcelain`. If uncommitted changes exist, warn the user and ask whether to proceed (fixes will be mixed with existing changes) or abort Phase 5.
- **`--quick-fix` in a non-git repo**: Skip the commit proposal (Phase 5.4). Apply fixes and print the summary only.
- **`--changed-only` in a non-git repo**: ERROR — `--changed-only` requires git. Exit immediately with: "`--changed-only` requires a git repository."
- **`--changed-only` with no changes**: "No files changed since `{ref}`. Nothing to audit." Exit gracefully with no report.
- **`--changed-only` with invalid ref**: Error with the ref name and stop: "Invalid git ref: `{ref}`"
- **`--changed-only` with `--quick`**: IGNORED. Note in report: "Changed-only mode is already fast — `--quick` flag was ignored."
- **`--changed-only` with binary files in diff**: Grep silently skips binary files. This is expected — document in Phase 1.9 but do not treat as an error.
- **`--changed-only` with renamed files**: `git diff --name-only` shows the new filename only, which is correct for auditing current state.
- **`--ci` with `--suggest-fixes`**: IGNORED. Noted in `metadata.ignored_flags` in the JSON output.
- **`--ci` with `--quick-fix`**: IGNORED. Noted in `metadata.ignored_flags` in the JSON output.
- **`--ci` with no findings**: Status "pass", empty findings array, `findings_count: 0`.
- **`--ci` on first run (no baseline)**: Apply threshold normally, write baseline for future runs, `regression` field is null in JSON.
- **`--json` without `--ci`**: JSON output, no exit codes, no plan file written, AskUserQuestion suppressed. Status is always "pass".
- **`--min-severity` does not affect health score**: Score always counts all findings. `summary` reflects full audit. `findings` array and `findings_count` are filtered. `summary.total` and `findings_count` may differ — this is intentional.
- **`--fail-on-new` without baseline**: Falls back to normal threshold behavior (compares against all findings, not just new ones).
- **`--baseline-only` without `--ci` or `--json`**: ERROR — requires structured output mode.
- **`--baseline-only` with `--fail-on-new`**: ERROR — mutually exclusive. Use `--baseline-only` for the first run, then `--fail-on-new` for subsequent runs.
- **`--baseline-only` with `--fail-on-regression`**: ERROR — mutually exclusive. `--baseline-only` always passes, so regression gating contradicts its purpose.
- **`--baseline-only` re-run**: Overwrites the previous baseline. Idempotent and safe to re-run.
- **`--format sarif` with `--suggest-fixes`/`--quick-fix`**: IGNORED. SARIF does not carry inline diffs.
- **`--format sarif` standalone (no `--ci`)**: SARIF to stdout, no exit codes. Equivalent to `--json` but in SARIF format.
- **`--format sarif` with `--min-severity`**: Filters both `results` and `rules` arrays. Only rules referenced by included results are declared.
- **`--format sarif` findings without file locations**: Result omits `locations` array. Valid SARIF, but GitHub renders these less usefully.
- **`--format sarif` in non-git repo**: File paths are relative to `pwd` instead of git root.
- **`--format <invalid>`**: Error: "Unsupported format: `{value}`. Supported formats: `json`, `sarif`." Stop immediately.
- **Infrastructure scanning with no infra files detected**: Skipped entirely. No Infrastructure row in the summary table, no noise in the report.
- **Infrastructure scanning with missing infra checklist file**: WARN: "Infrastructure checklist not found — skipping infra patterns." Continue the audit without infra patterns.
- **`--no-infra` with infra files present**: Respected. Infrastructure scanning is skipped. Note in Tips block: "Infrastructure files detected but scanning was disabled via `--no-infra`."
- **`--quick` with infra files**: Runs `[QUICK]`-tagged infra patterns (FROM latest, running as root, privileged containers) alongside existing quick patterns.

---

## Key Rules

1. During audit phases (1-3), you MUST NOT modify any source code. Phase 4 writes the report/baseline to `$AUDIT_HOME` and the fix plan to the plan file. Phase 5 (`--quick-fix` only) applies mechanical fixes to source code — this is the only phase that modifies project files. When the plan is executed (after "Ready to code?"), you may edit source code to implement the remaining fixes.
2. Findings that reference specific code MUST include `file:line`. Findings about missing functionality (missing tests, missing error handling), dependency vulnerabilities, or architectural patterns should reference the most relevant file or component instead. Never report a finding you cannot anchor to something concrete in the codebase.
3. Reports are saved to your home directory (`$AUDIT_HOME`), not the project directory. They may contain security findings — do not commit them to public repos.
4. No hallucinating findings. Every finding must reference a specific file and line (or component for non-code findings). If you can't point to it, don't report it.
5. Use the severity calibration definitions exactly as specified. Do not inflate or deflate severity.
6. In quick mode, respect the 2-minute target. Do not run Phase 2 or the full Phase 3 checklist. `--changed-only` also skips Phase 2 and does not write a baseline.
7. AskUserQuestion fires in three places: (1) Phase 1 if >50K LOC, to scope the audit; (2) Phase 4.7 after the plan is written, to offer the next step; (3) Phase 5 (`--quick-fix` only) for dirty working tree check and commit proposal. In `--ci` or `--json` mode, AskUserQuestion is NEVER called — all decisions are made automatically. Do not use AskUserQuestion elsewhere during the audit.
8. All bash blocks are self-contained. Do not rely on shell variables persisting between code blocks.
9. When reading files for context, read enough surrounding lines to understand the code — do not make judgments from a single line in isolation.
10. Cap detailed findings at 50. Summarize overflow in a table.
11. Be aware of your knowledge cutoff. Do not flag dependency versions, language versions, or API usage as "deprecated" or "nonexistent" based solely on your training data. If uncertain whether a version exists, state the uncertainty rather than asserting it as a finding.
12. Always use the Read tool to read files — never use `cat` via Bash. The Read tool provides better context and is the expected convention.
13. The audit is planning-for-a-plan. Phases 1-3 are read-only research. Phase 4 produces two outputs: the archival report (written to `$AUDIT_HOME` via Bash) and the fix plan (written to the plan file). The plan file is the correct, actionable output — "Ready to code?" means "execute this fix plan." When `--quick-fix` is active, findings auto-applied by Phase 5 are marked `[AUTO-APPLYING]` in the plan — only substantive and review-suggested items remain actionable.
14. **NEVER use Grep in `content` mode during checklist execution.** Always use `files_with_matches` mode. If a regex returns more than ~20 lines, the pattern is too broad — use `files_with_matches` to get filenames, then Read specific line ranges. Multiline regex patterns (e.g., patterns matching across `{` `}` boundaries) are especially dangerous and must NEVER be run in content mode.
15. When `--suggest-fixes` is active, generate diffs during Phase 3 immediately after confirming each finding — not batched at the end of Phase 3, not retroactively in Phase 4. The code context from the Read that confirmed the finding is essential for accurate diffs. Each diff must be a minimal, conservative change. Never suggest refactoring beyond the specific finding. If a finding cannot be fixed with a short diff, mark it accordingly rather than forcing a bad suggestion. The unified diff format enables `--quick-fix` (Phase 5) to parse and apply diffs mechanically.
16. `--quick-fix` implies `--suggest-fixes`. If the user passes `--quick-fix` without `--suggest-fixes`, activate suggest-fixes behavior automatically. Quick-fix requires diffs to apply.
17. When `--format sarif` is active, rule IDs must be deterministic (`{category}/{kebab-title}`) and declared in `tool.driver.rules[]` before being referenced in `results[]`. File paths must be relative to the git root with forward slashes and no leading `./`. Use `%SRCROOT%` as the `uriBaseId`. `message.text` contains the title only; `rule.fullDescription.text` contains the recommendation.
