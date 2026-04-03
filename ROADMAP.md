# Roadmap

Planned features and improvements for `/codebase-audit`.

---

## Focused Audit Modes

Category-scoped audits that run only a subset of the checklist.

- `--security-only` — run only the Security category
- `--tests-only` — run only the Tests category
- `--perf-only` — run only the Performance category
- General pattern: `--<category>-only` for any checklist category

These should compose with other flags (e.g., `--security-only --suggest-fixes`).

**Design question:** Should these skip Phase 2 (architecture scan) or still run it for context? Leaning toward skip — if you're focused on security, you want speed.

---

## CI Mode (`--ci`)

Machine-readable output for CI pipelines.

- Exit code 0 = no critical/important findings, exit code 1 = findings above threshold
- JSON output to stdout (findings array, health score, summary counts)
- Configurable fail threshold: `--ci --fail-on important` vs `--ci --fail-on critical`
- No interactive prompts (AskUserQuestion disabled)
- Baseline comparison built in: fail if score regressed or new critical findings appeared

`--suggest-fixes` is ignored in CI mode (diffs add latency and CI wants pass/fail, not fix suggestions).

---

## Infrastructure Scanning (`--plus-infra`)

New scan surface for infrastructure-as-code and DevOps configs. These file types are currently ignored by the base audit.

Candidates:
- **Dockerfiles** — `FROM latest`, running as root, secrets in build args, multi-stage leaks
- **Kubernetes manifests** — privileged containers, missing resource limits, host networking
- **Terraform/OpenTofu** — overly permissive IAM policies, public S3 buckets, missing encryption
- **CI/CD pipelines** — secrets in env vars, missing pinned action versions, self-hosted runner risks
- **nginx/Apache configs** — missing security headers, open proxies, TLS misconfig
- **Compose files** — exposed ports, missing health checks, volume mount risks

This is a genuinely new scan surface, not just more patterns for existing categories. The `--plus-infra` flag opts in because infrastructure configs require different pattern sets and may not exist in every project.

---

## Expanded Language Patterns

More language-specific patterns in `references/patterns.md`. Current coverage:

- [x] JavaScript / TypeScript
- [x] Python
- [x] Ruby / Rails
- [x] Go
- [x] Rust
- [x] Swift / iOS
- [x] PHP
- [ ] Java / Spring
- [ ] C# / .NET
- [ ] Kotlin / Android
- [ ] Elixir / Phoenix
- [ ] C / C++
- [ ] Shell scripting (bash/zsh anti-patterns)

---

## Fix Workflow

Three tiers of fix automation, from safest to most autonomous:

### `--suggest-fixes` (exists today)
Generates unified diffs inline with findings. Read-only — user applies manually.

### `--quick-fix` (new)
Automatically apply mechanical, high-confidence fixes. Scope:
- One-liner fixes only (single file, <10 lines changed)
- Must be tagged `[HIGH CONFIDENCE]` by the audit
- Examples: adding `.gitignore` entries, pinning dependency versions, narrowing catch types, adding missing timeouts with safe defaults
- Creates a single commit with all applied fixes
- Prints a summary of what was changed and what was skipped

**Not in scope for `--quick-fix`:** anything tagged `[REVIEW SUGGESTED]`, multi-file changes, architectural fixes, test additions.

### `--plan-fixes` (new)
Generate a comprehensive fix plan (what `--suggest-fixes` does today for the plan file, but more structured). Outputs an actionable plan covering both mechanical and substantive fixes, with estimated scope per item. Does not apply anything — the user reviews and accepts.

Naming rationale: `--fix` is too ambiguous and implies "go wild." `--quick-fix` clearly scopes to safe one-liners. `--plan-fixes` clearly scopes to planning, not execution.

---

## Output and Filtering

### `--json`
Structured JSON output for tooling and dashboards. Distinct from `--ci` (which is about exit codes and pipeline integration). `--json` outputs the full findings array, health score, baseline comparison, and metadata.

### `--min-severity <level>`
Filter output to only show findings at or above a severity threshold.
- `--min-severity critical` — only critical findings
- `--min-severity important` — critical + important
- `--min-severity notable` — everything except opportunities

Applies to both report output and exit codes (in `--ci` mode).

### `--changed-only [ref]`
Audit only files changed since a git ref (default: merge base of current branch).
Bridges the gap between "full cold-start audit" and "PR review." Still uses the full checklist — just scoped to changed files.

---

## Checklist Plugins

Beyond the single `.codebase-audit/checklist.md` custom checklist, support named checklist packs:

```
/codebase-audit --checklist hipaa
/codebase-audit --checklist fintech
/codebase-audit --checklist owasp-api
```

Plugin resolution: `~/.claude/skills/codebase-audit/checklists/<name>.md`

This enables community-contributed domain-specific checklists without bloating the built-in checklist.

---

## Priority Order

Rough implementation priority based on user value and complexity:

1. Focused modes (`--security-only` etc.) — low complexity, high value
2. `--quick-fix` — natural extension of existing `--suggest-fixes`
3. `--ci` + `--json` — enables automation, often requested
4. `--min-severity` — simple filter, useful with `--ci`
5. `--plus-infra` — new scan surface, medium complexity
6. `--changed-only` — useful but overlaps with PR review tools
7. `--plan-fixes` — refinement of existing plan output
8. Expanded language patterns — ongoing, incremental
9. Checklist plugins — nice-to-have, needs plugin discovery design
