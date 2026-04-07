import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("Skill structure validation", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

  test("SKILL.md exists and is non-empty", () => {
    expect(skillMd.length).toBeGreaterThan(100);
  });

  test("has valid YAML frontmatter", () => {
    expect(skillMd).toMatch(/^---\n/);
    expect(skillMd).toMatch(/\nname: codebase-audit\n/);
    const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf-8").trim();
    expect(skillMd).toContain(`version: ${version}`);
    expect(skillMd).toMatch(/\ndescription: \|/);
    expect(skillMd).toMatch(/\nallowed-tools:/);
  });

  test("has required sections", () => {
    const requiredSections = [
      "## Preamble",
      "## Phase 1: Orientation",
      "## Phase 2: Architecture Scan",
      "## Phase 3: Targeted Deep Dives",
      "## Phase 4: Report Generation",
      "## Edge Cases",
      "## Key Rules",
    ];
    for (const section of requiredSections) {
      expect(skillMd).toContain(section);
    }
  });

  test("has mode documentation", () => {
    expect(skillMd).toContain("--quick");
    expect(skillMd).toContain("--suggest-fixes");
    expect(skillMd).toContain("--quick-fix");
    expect(skillMd).toContain("--changed-only");
    expect(skillMd).toContain("Regression");
  });

  test("has Phase 5 for quick-fix", () => {
    expect(skillMd).toContain("## Phase 5: Quick Fix Application");
  });

  test("has changed-only file resolution step", () => {
    expect(skillMd).toContain("### 1.9 Changed-only file resolution");
  });

  test("changed-only skips Phase 2", () => {
    expect(skillMd).toContain("--changed-only` is active (architecture scan");
  });

  test("changed-only skips baseline generation", () => {
    expect(skillMd).toContain(
      "Skip baseline generation if `--changed-only` is active",
    );
  });

  test("quick-fix implies suggest-fixes", () => {
    expect(skillMd).toContain(
      "`--quick-fix` implies `--suggest-fixes`",
    );
  });

  test("quick-fix is ignored in quick mode", () => {
    expect(skillMd).toContain("`--quick-fix` with `--quick`");
  });

  test("quick-fix eligibility criteria are documented", () => {
    expect(skillMd).toContain("[HIGH CONFIDENCE]");
    expect(skillMd).toContain("Less than 10 lines changed");
    expect(skillMd).toContain("Single file change");
  });

  test("has CI/JSON mode documentation", () => {
    expect(skillMd).toContain("--ci");
    expect(skillMd).toContain("--json");
    expect(skillMd).toContain("--fail-on");
    expect(skillMd).toContain("--fail-on-regression");
    expect(skillMd).toContain("--fail-on-new");
    expect(skillMd).toContain("--min-severity");
    expect(skillMd).toContain("### 4.8 Structured output");
    expect(skillMd).toContain("AskUserQuestion is NEVER called");
    expect(skillMd).toContain("cat <<'EOF'");
    expect(skillMd).toContain("ci-output.json");
    expect(skillMd).toContain("--baseline-only");
  });

  test("baseline-only mutual exclusions are documented", () => {
    expect(skillMd).toContain(
      "Cannot use `--baseline-only` with `--fail-on-new`",
    );
    expect(skillMd).toContain(
      "Cannot use `--baseline-only` with `--fail-on-regression`",
    );
  });

  test("has SARIF format documentation", () => {
    expect(skillMd).toContain("--format sarif");
    expect(skillMd).toContain("SARIF 2.1.0");
    expect(skillMd).toContain("sarif-schema-2.1.0");
    expect(skillMd).toContain("%SRCROOT%");
    expect(skillMd).toContain("results.sarif");
  });

  test("has infrastructure scanning documentation", () => {
    expect(skillMd).toContain("--no-infra");
    expect(skillMd).toContain("infra-checklist.md");
    expect(skillMd).toContain("skipping infra patterns");
    expect(skillMd).toContain("Infrastructure files detected");
  });

  test("has --plan-fixes alias flag preserved (v1.9.0 carve-out)", () => {
    // The flag itself stays as a backward-compat alias.
    expect(skillMd).toContain("--plan-fixes");
    expect(skillMd).toContain("--thorough");
    // It's now documented as an alias, not inline logic.
    expect(skillMd).toContain("alias");
    expect(skillMd).toContain("/plan-fixes");
  });

  test("Phase 4.7 dispatches to /plan-fixes sibling skill", () => {
    // The dispatch directive must reference the sibling skill and --from
    expect(skillMd).toMatch(/\/plan-fixes.*--from/s);
    // Existence check for the sibling skill is documented
    expect(skillMd).toContain("~/.claude/skills/plan-fixes");
    // --thorough propagation is explicit
    expect(skillMd).toContain("--thorough");
  });

  test("Phase 4.7 dispatch ordering under --quick-fix defers to Phase 5.5", () => {
    // When --quick-fix is also active, the dispatch must happen after Phase 5.5
    // so /plan-fixes sees the post-application baseline.
    expect(skillMd).toContain("Phase 5.5");
    expect(skillMd).toMatch(/quick_fix_status/);
  });

  test("Phase 5.5 baseline rewrite is documented", () => {
    expect(skillMd).toContain("### 5.5 Rewrite baseline");
    expect(skillMd).toContain("quick_fix_status");
    // Option D requires this to be accurate post-application
    expect(skillMd).toMatch(/atomically|temp file.*rename/i);
  });

  test("alias dispatch failure is documented with recovery command", () => {
    // The user must learn the audit succeeded and get a manual recovery path
    expect(skillMd).toContain("Audit completed successfully");
    expect(skillMd).toContain("Baseline written to");
    expect(skillMd).toMatch(/\/plan-fixes --from/);
  });

  test("Phase 4.6 tip points to standalone /plan-fixes", () => {
    // The rewritten tip teaches the new skill name, not the alias
    expect(skillMd).toContain("substantive findings");
    expect(skillMd).toContain("/plan-fixes");
    expect(skillMd).toContain("no re-audit needed");
  });

  test("SARIF discoverability tip fires after alias dispatch", () => {
    expect(skillMd).toContain("SARIF 2.1.0");
    expect(skillMd).toMatch(/--from results\.sarif/);
  });

  test("--plan-fixes edge cases are documented for alias behavior", () => {
    expect(skillMd).toContain("`--plan-fixes` with `--ci`");
    expect(skillMd).toContain("`--plan-fixes` with `--quick`");
    expect(skillMd).toContain("`--plan-fixes --thorough`");
    expect(skillMd).toContain("`--plan-fixes --quick-fix`");
    expect(skillMd).toContain("`--plan-fixes` when `/plan-fixes` sibling skill is not installed");
    expect(skillMd).toContain("`--thorough` without `--plan-fixes`");
  });

  test("Key Rule 7 reverted to three AskUserQuestion locations in codebase-audit", () => {
    // v1.9.0 moved depth consent and plan menu to /plan-fixes, so codebase-audit's
    // own AskUserQuestion surface is back to the pre-v1.8.0 three locations.
    expect(skillMd).toContain("AskUserQuestion fires in three places");
    // Explicitly note the moved locations
    expect(skillMd).toMatch(/depth consent.*plan menu.*\/plan-fixes/s);
  });

  test("Key Rule 2 enforces output discipline (grep mode, dump traps, targeted reads, probe exit-0)", () => {
    // Key Rule 2 was promoted from position 14 in v1.9.0 to make output discipline
    // prominent during Phase 3 checklist execution. Four sub-rules (2a-2d) cover
    // grep content-mode ban, bash dump traps, targeted Read ranges, and probe
    // commands that must exit 0 so parallel tool batches don't cascade-cancel.
    expect(skillMd).toContain("**2a.");
    expect(skillMd).toContain("**2b.");
    expect(skillMd).toContain("**2c.");
    expect(skillMd).toContain("**2d.");
    // 2a: grep content mode ban with the "Found N lines" vs "Found N files" tell —
    // this is the crucial signal that reveals which mode the caller is actually in.
    expect(skillMd).toContain("files_with_matches");
    expect(skillMd).toContain('"Found N lines"');
    expect(skillMd).toContain('"Found N files"');
    // 2b: concrete dump traps named with counter-forms
    expect(skillMd).toContain("pip-audit");
    expect(skillMd).toContain("wc -l");
    // 2c: targeted reads rule of thumb
    expect(skillMd).toMatch(/~30 lines/);
    // 2d: probe commands exit 0, cascade-cancel hazard named, canonical for-loop pattern
    expect(skillMd).toContain("cascade-cancel");
    expect(skillMd).toContain("[ -e");
    expect(skillMd).toMatch(/for f in[\s\S]+?\[ -e "\$f" \] && echo "\$f"/);
  });

  test("Phase 1.7 dependency check uses jq to filter vulnerabilities", () => {
    // v1.9.0 replaced the raw `--format json` dumps with jq-piped forms so a clean
    // audit emits one line ("No dependency vulnerabilities.") instead of dumping
    // the whole dep list. Covers pip-audit, npm audit, and cargo audit at minimum.
    expect(skillMd).toContain("pip-audit -f json");
    expect(skillMd).toContain("jq");
    expect(skillMd).toContain("No dependency vulnerabilities.");
    // Fallback when jq is unavailable
    expect(skillMd).toMatch(/jq.*not installed|fall back/i);
  });

  test("has voice directive", () => {
    expect(skillMd).toContain("## Voice");
  });

  test("has preamble with SLUG via shared contract", () => {
    expect(skillMd).toContain("SLUG=");
    expect(skillMd).toContain("AUDIT_HOME=");
    expect(skillMd).toContain("CODEBASE_AUDIT_HOME");
    // v1.9.0: slug derivation moved to lib/slug.sh shared script
    expect(skillMd).toContain("lib/slug.sh");
  });
});

describe("Supporting files exist", () => {
  test("checklist.md exists and has content", () => {
    const content = fs.readFileSync(path.join(ROOT, "checklist.md"), "utf-8");
    expect(content.length).toBeGreaterThan(50);
  });

  test("report-template.md exists and has content", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "report-template.md"),
      "utf-8",
    );
    expect(content.length).toBeGreaterThan(50);
  });

  test("references/patterns.md exists and has content", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "references", "patterns.md"),
      "utf-8",
    );
    expect(content.length).toBeGreaterThan(50);
  });
});

describe("File references in SKILL.md resolve", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

  test("checklist path references ~/.claude/skills/codebase-audit/checklist.md", () => {
    expect(skillMd).toContain(
      "~/.claude/skills/codebase-audit/checklist.md",
    );
  });

  test("patterns path references ~/.claude/skills/codebase-audit/references/patterns.md", () => {
    expect(skillMd).toContain(
      "~/.claude/skills/codebase-audit/references/patterns.md",
    );
  });

  test("report template path references ~/.claude/skills/codebase-audit/report-template.md", () => {
    expect(skillMd).toContain(
      "~/.claude/skills/codebase-audit/report-template.md",
    );
  });
});

describe("No external dependencies", () => {
  test("zero references to parent project in entire repo", () => {
    // Read all markdown, typescript, and json files and check for references
    const files = [
      "SKILL.md",
      "checklist.md",
      "report-template.md",
      "references/patterns.md",
      "README.md",
      "CHANGELOG.md",
      "package.json",
    ];
    for (const file of files) {
      const filePath = path.join(ROOT, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        // Check for gstack references (the parent project)
        const matches = content.match(/gstack/gi);
        expect(matches).toBeNull();
      }
    }
  });
});

describe("Metadata files", () => {
  test("VERSION exists and matches semver", () => {
    const version = fs
      .readFileSync(path.join(ROOT, "VERSION"), "utf-8")
      .trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("LICENSE exists", () => {
    expect(fs.existsSync(path.join(ROOT, "LICENSE"))).toBe(true);
  });

  test("CHANGELOG.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "CHANGELOG.md"))).toBe(true);
  });

  test("README.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "README.md"))).toBe(true);
  });

  test("CLAUDE.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "CLAUDE.md"))).toBe(true);
  });

  test("ROADMAP.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "ROADMAP.md"))).toBe(true);
  });

  test("setup script exists and is executable", () => {
    const setupPath = path.join(ROOT, "setup");
    expect(fs.existsSync(setupPath)).toBe(true);
    const stats = fs.statSync(setupPath);
    expect(stats.mode & 0o111).toBeGreaterThan(0);
  });
});

describe("Package.json scripts", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"),
  );

  test("test script runs all tests, not a single file", () => {
    expect(pkg.scripts.test).toBe("bun test");
  });

  test("test:evals script exists for gated e2e tests", () => {
    expect(pkg.scripts["test:evals"]).toContain("EVALS=1");
    expect(pkg.scripts["test:evals"]).toContain("e2e.test.ts");
  });

  test("no test:all script (redundant with widened test script)", () => {
    expect(pkg.scripts["test:all"]).toBeUndefined();
  });
});

describe("No empty scaffolding directories", () => {
  test("test/fixtures does not exist", () => {
    expect(fs.existsSync(path.join(ROOT, "test", "fixtures"))).toBe(false);
  });

  test("test/helpers does not exist", () => {
    expect(fs.existsSync(path.join(ROOT, "test", "helpers"))).toBe(false);
  });
});
