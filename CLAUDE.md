# codebase-audit

Claude Code skill for cold-start codebase audits. This is a skill definition (markdown + tests), not a running application.

## Key Files

- `SKILL.md` — Skill entry point. Defines the 4-phase audit pipeline. This is the primary development surface.
- `checklist.md` — Audit patterns with grep-friendly regex. Each pattern has a severity and explanation.
- `references/patterns.md` — Supplemental language-specific anti-patterns.
- `report-template.md` — Output structure for audit reports.
- `setup` — Install script. Creates symlink from `~/.claude/skills/codebase-audit` to this directory.
- `VERSION` — Semver version, referenced by setup script and SKILL.md frontmatter.

## Development

```bash
bun test                    # Run all tests (structural + pattern + e2e)
bun run test:evals          # Run only e2e eval tests (requires EVALS=1)
./setup                     # Install/update the skill symlink
```

## Constraints

- The skill is read-only during audit phases 1-3. It only writes reports to `~/.codebase-audits/`.
- Checklist patterns must be valid ripgrep regex (not GNU grep).
- Keep SKILL.md self-contained — Claude reads it as a single document.
- Changes to SKILL.md frontmatter (`version`, `name`, `allowed-tools`) affect skill discovery and behavior.
