import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

/**
 * Slim structural test for /deps. Why this is structurally minimal:
 *
 * /deps is a pure-markdown skill that delegates entirely to ecosystem CLI
 * tools (npm, go, pip, etc.). There's no internal logic to test mechanically.
 * The behavior is LLM reasoning over CLI output, which we can't unit-test.
 *
 * What we CAN catch cheaply at PR time: frontmatter typos. If the YAML
 * frontmatter has a syntax error, a missing required field, or a name
 * mismatch, Claude Code will fail to load the skill at runtime. Surfacing
 * that at PR time instead of "huh, /deps doesn't work in my new session"
 * is the entire purpose of this file.
 *
 * Notably absent: a VERSION-file cross-reference like the codebase-audit
 * and plan-fixes skill-validation tests have. /deps deliberately has no
 * VERSION file (no release cadence, no per-skill bumping). The frontmatter
 * version is a static semver-shaped string and stays that way until someone
 * explicitly changes it.
 */
describe("/deps skill structure", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "deps", "SKILL.md"), "utf-8");

  test("SKILL.md exists and is non-empty", () => {
    expect(skillMd.length).toBeGreaterThan(1000);
  });

  test("has valid YAML frontmatter", () => {
    expect(skillMd).toMatch(/^---\n/);
    expect(skillMd).toMatch(/\nname: deps\n/);
    expect(skillMd).toMatch(/\nversion: \d+\.\d+\.\d+\n/);
    expect(skillMd).toMatch(/\ndescription: \|/);
    expect(skillMd).toMatch(/\nallowed-tools:/);
  });

  test("has Dependency Remediation Agent body", () => {
    expect(skillMd).toContain("# Dependency Remediation Agent");
  });

  test("documents the four subcommands", () => {
    expect(skillMd).toContain("audit");
    expect(skillMd).toContain("update");
    expect(skillMd).toContain("cve");
    expect(skillMd).toContain("triage");
  });
});
