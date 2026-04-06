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

  test("has voice directive", () => {
    expect(skillMd).toContain("## Voice");
  });

  test("has preamble with SLUG computation", () => {
    expect(skillMd).toContain("SLUG=");
    expect(skillMd).toContain("AUDIT_HOME=");
    expect(skillMd).toContain("CODEBASE_AUDIT_HOME");
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
