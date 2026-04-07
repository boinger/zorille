import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("/plan-fixes skill structure", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

  test("SKILL.md exists and is non-empty", () => {
    expect(skillMd.length).toBeGreaterThan(1000);
  });

  test("has valid YAML frontmatter", () => {
    expect(skillMd).toMatch(/^---\n/);
    expect(skillMd).toMatch(/\nname: plan-fixes\n/);
    const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf-8").trim();
    expect(skillMd).toContain(`version: ${version}`);
    expect(skillMd).toMatch(/\ndescription: \|/);
    expect(skillMd).toMatch(/\nallowed-tools:/);
  });

  test("VERSION file is valid semver", () => {
    const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf-8").trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("has required sections", () => {
    const required = [
      "## Preamble",
      "## Arguments",
      "## Phase 1: Load findings",
      "## Phase 2: Group findings",
      "## Phase 3: Classify group depth",
      "## Phase 4: Depth consent",
      "## Phase 5: Depth investigation",
      "## Phase 6: Generate plan files",
      "## Phase 7: Present menu",
      "## Edge Cases",
      "## Key Rules",
    ];
    for (const section of required) {
      expect(skillMd).toContain(section);
    }
  });

  test("Phase 1 references the shared slug contract", () => {
    expect(skillMd).toMatch(/bash\s+["']?\$\{?REPO_ROOT\}?\/lib\/slug\.sh/);
  });

  test("Phase 1 documents baseline.json schema fields", () => {
    expect(skillMd).toContain("quick_fix_status");
    expect(skillMd).toContain("findings[]");
    expect(skillMd).toContain("version");
  });

  test("Phase 1 documents SARIF 2.1.0 mapping", () => {
    expect(skillMd).toContain("SARIF 2.1.0");
    expect(skillMd).toContain("level");
    expect(skillMd).toContain("error→critical");
    expect(skillMd).toContain("runs[]");
    expect(skillMd).toContain("tool.driver.name");
    expect(skillMd).toContain("physicalLocation");
    expect(skillMd).toContain("region.startLine");
    expect(skillMd).toContain("properties.tags");
  });

  test("Phase 1E path validation is documented", () => {
    expect(skillMd).toContain("file://");
    expect(skillMd).toContain("..");
    expect(skillMd).toContain("realpath");
    expect(skillMd).toContain("symlink");
    expect(skillMd).toContain("git ls-files");
  });

  test("Phase 1F LLM injection mitigation is documented", () => {
    expect(skillMd).toContain("<untrusted-input>");
    expect(skillMd).toContain("500");
    expect(skillMd).toContain("markdown delimiters");
  });

  test("Phase 2 grouping heuristic markers present", () => {
    expect(skillMd).toContain("60%");
    expect(skillMd).toContain("Part N of M");
    expect(skillMd).toContain("8 findings");
    expect(skillMd).toContain("5 files");
  });

  test("Phase 5 depth investigation patterns present", () => {
    expect(skillMd).toContain("Skipped caller analysis");
    expect(skillMd).toContain("__tests__/");
    expect(skillMd).toContain("src/test/");
    expect(skillMd).toContain("bracket matching");
  });

  test("Phase 6 Option D markers present", () => {
    expect(skillMd).toContain("[ALREADY APPLIED]");
    expect(skillMd).toContain("plan-standard.md");
    expect(skillMd).toContain("plan-mixed.md");
    expect(skillMd).toContain("plan-applied.md");
  });

  test("Risk rubric present", () => {
    expect(skillMd).toContain("**High**: 3+ callers");
    expect(skillMd).toContain("**Medium**: single file with tests");
    expect(skillMd).toContain("**Low**: isolated change");
  });

  test("three template files exist", () => {
    for (const name of ["plan-standard.md", "plan-mixed.md", "plan-applied.md"]) {
      const p = path.join(ROOT, "templates", name);
      expect(fs.existsSync(p)).toBe(true);
    }
  });

  test("plan-standard template has all required sections", () => {
    const t = fs.readFileSync(
      path.join(ROOT, "templates", "plan-standard.md"),
      "utf-8",
    );
    expect(t).toContain("# Fix Plan:");
    expect(t).toContain("## Findings");
    expect(t).toContain("## Approach");
    expect(t).toContain("## Files to Modify");
    expect(t).toContain("## Risk");
    expect(t).toContain("## Verify & Rollback");
    expect(t).toContain("## Dependencies");
  });

  test("plan-mixed template has Status column note", () => {
    const t = fs.readFileSync(
      path.join(ROOT, "templates", "plan-mixed.md"),
      "utf-8",
    );
    expect(t).toContain("Status");
    expect(t).toContain("pending");
    expect(t).toContain("applied");
    expect(t).toContain("## Approach");
  });

  test("plan-applied template replaces Approach with Status section", () => {
    const t = fs.readFileSync(
      path.join(ROOT, "templates", "plan-applied.md"),
      "utf-8",
    );
    expect(t).toContain("[ALREADY APPLIED]");
    expect(t).toContain("## Status");
    expect(t).not.toContain("## Approach");
    expect(t).not.toContain("## Files to Modify");
    expect(t).not.toContain("## Verify & Rollback");
  });

  test("AskUserQuestion locations are documented", () => {
    expect(skillMd).toContain("Phase 4");
    expect(skillMd).toContain("Phase 7");
    expect(skillMd).toMatch(/AskUserQuestion.*(two places|Phase 4|Phase 7)/s);
  });

  test("flags are documented", () => {
    expect(skillMd).toContain("--from");
    expect(skillMd).toContain("--baseline");
    expect(skillMd).toContain("--sarif");
    expect(skillMd).toContain("--thorough");
    expect(skillMd).toContain("--show-applied");
    expect(skillMd).toContain("--verbose");
  });

  test("allowed-tools includes expected Claude Code tools", () => {
    expect(skillMd).toContain("Bash");
    expect(skillMd).toContain("Read");
    expect(skillMd).toContain("Grep");
    expect(skillMd).toContain("Glob");
    expect(skillMd).toContain("Write");
    expect(skillMd).toContain("AskUserQuestion");
  });
});
