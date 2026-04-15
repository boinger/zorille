import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import * as path from "path";

/**
 * Structural tests for /issue-forensics skill definition.
 *
 * Asserts the invariants the implementation session committed to:
 *   - SKILL.md has valid frontmatter with required fields
 *   - VERSION is valid semver and starts at 0.1.0 or later
 *   - CHANGELOG.md exists
 *   - references/loki-21524.md exists with a provenance header
 *   - SKILL.md invokes lib/slug.sh (shared infra contract)
 *   - SKILL.md documents the load-bearing target-repo confirmation prompt
 *   - SKILL.md documents the quick-report exit template
 *   - SKILL.md describes all five pillars
 *
 * These are structural, not behavioral. They don't dogfood the skill — they
 * catch "did the implementer actually land what the plan specified" drift.
 */

const ROOT = path.resolve(__dirname, "..");
const SKILL_DIR = path.join(ROOT, "issue-forensics");

describe("/issue-forensics structural invariants", () => {
  test("skill directory exists", () => {
    expect(fs.existsSync(SKILL_DIR)).toBe(true);
    expect(fs.statSync(SKILL_DIR).isDirectory()).toBe(true);
  });

  test("VERSION is valid semver, >= 0.1.0", () => {
    const versionPath = path.join(SKILL_DIR, "VERSION");
    expect(fs.existsSync(versionPath)).toBe(true);
    const raw = fs.readFileSync(versionPath, "utf-8").trim();
    expect(raw).toMatch(/^\d+\.\d+\.\d+$/);
    const [maj, min] = raw.split(".").map(Number);
    // v0.1.0 or later (can't regress below initial release)
    expect(maj > 0 || (maj === 0 && min >= 1)).toBe(true);
  });

  test("CHANGELOG.md exists and references the current VERSION", () => {
    const changelog = path.join(SKILL_DIR, "CHANGELOG.md");
    expect(fs.existsSync(changelog)).toBe(true);
    const version = fs
      .readFileSync(path.join(SKILL_DIR, "VERSION"), "utf-8")
      .trim();
    const content = fs.readFileSync(changelog, "utf-8");
    expect(content).toContain(`[${version}]`);
  });

  test("SKILL.md has required frontmatter fields", () => {
    const skillPath = path.join(SKILL_DIR, "SKILL.md");
    expect(fs.existsSync(skillPath)).toBe(true);
    const content = fs.readFileSync(skillPath, "utf-8");

    // Frontmatter block
    expect(content.startsWith("---\n")).toBe(true);
    const endMarker = content.indexOf("\n---\n", 4);
    expect(endMarker).toBeGreaterThan(0);
    const frontmatter = content.slice(4, endMarker);

    // Required fields
    expect(frontmatter).toMatch(/^name:\s*issue-forensics\s*$/m);
    expect(frontmatter).toMatch(/^version:\s*\d+\.\d+\.\d+\s*$/m);
    expect(frontmatter).toMatch(/^description:/m);
    expect(frontmatter).toMatch(/^allowed-tools:/m);
  });

  test("SKILL.md version matches VERSION file", () => {
    const version = fs
      .readFileSync(path.join(SKILL_DIR, "VERSION"), "utf-8")
      .trim();
    const content = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf-8");
    expect(content).toMatch(new RegExp(`^version:\\s*${version}\\s*$`, "m"));
  });

  test("exemplar file exists with provenance header", () => {
    const exemplar = path.join(SKILL_DIR, "references", "loki-21524.md");
    expect(fs.existsSync(exemplar)).toBe(true);
    const content = fs.readFileSync(exemplar, "utf-8");

    // Provenance header is a YAML frontmatter block with required fields.
    expect(content.startsWith("---\n")).toBe(true);
    const endMarker = content.indexOf("\n---\n", 4);
    expect(endMarker).toBeGreaterThan(0);
    const provenance = content.slice(4, endMarker);

    expect(provenance).toMatch(/^source_url:\s*https:\/\/github\.com\//m);
    expect(provenance).toMatch(/^source_repo:\s*grafana\/loki\s*$/m);
    expect(provenance).toMatch(/^issue_number:\s*21524\s*$/m);
    expect(provenance).toMatch(/^author:/m);
    expect(provenance).toMatch(/^captured:\s*\d{4}-\d{2}-\d{2}\s*$/m);
    expect(provenance).toMatch(/^capture_sha:\s*[0-9a-f]{7,40}\s*$/m);
  });

  test("SKILL.md invokes lib/slug.sh via $LIB_DIR (shared infra contract)", () => {
    const content = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf-8");
    expect(content).toMatch(/bash\s+["']?\$\{?LIB_DIR\}?\/slug\.sh["']?/);
  });

  test("SKILL.md documents the target-repo confirmation prompt", () => {
    // Phase 1 of the skill: the load-bearing "ask first, don't guess" gate.
    // Verify the section and its rationale are present so it can't silently
    // regress back to "default cwd = target."
    const content = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf-8");
    expect(content).toMatch(/Target-repo confirmation/i);
    expect(content).toMatch(/Ask first, don't guess/i);
    expect(content).toMatch(/--target/);
  });

  test("SKILL.md documents the quick-report exit template", () => {
    const content = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf-8");
    expect(content).toMatch(/Quick-report/i);
    expect(content).toMatch(/What I observed/);
    expect(content).toMatch(/How to reproduce/);
    expect(content).toMatch(/Proposed fix/);
  });

  test("SKILL.md describes all five pillars", () => {
    const content = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf-8");
    expect(content).toMatch(/Pillar 1/i);
    expect(content).toMatch(/Pillar 2/i);
    expect(content).toMatch(/Pillar 3/i);
    expect(content).toMatch(/Pillar 4/i);
    expect(content).toMatch(/Pillar 5/i);
    // The BAD/GOOD distinction in Pillar 3 is the central prompt discipline.
    expect(content).toMatch(/stated intent/i);
    expect(content).toMatch(/side-effect/i);
  });

  test("SKILL.md declares the quality checklist pass bar", () => {
    const content = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf-8");
    expect(content).toMatch(/Quality checklist/i);
    expect(content).toMatch(/Pass bar/i);
  });
});

describe("setup SKILLS array consistency", () => {
  /**
   * The setup script has a hardcoded SKILLS=(...) array at line 5. Adding a
   * skill requires editing that array. This test asserts the array stays
   * consistent with what's actually on disk — catches both forgetting to
   * add a new skill AND leaving a stale reference after removal.
   */

  test("every skill in SKILLS=(...) has a corresponding directory", () => {
    const setupContent = fs.readFileSync(path.join(ROOT, "setup"), "utf-8");
    const match = setupContent.match(/^SKILLS=\((.*?)\)$/m);
    expect(match, "SKILLS=(...) array not found in setup script").not.toBeNull();

    const declared = match![1]
      .split(/\s+/)
      .map((s) => s.replace(/^["']|["']$/g, ""))
      .filter(Boolean);

    // codebase-audit is the repo root; others are sibling directories.
    for (const skill of declared) {
      if (skill === "codebase-audit") {
        // Repo root is the /codebase-audit skill; check its SKILL.md.
        expect(fs.existsSync(path.join(ROOT, "SKILL.md"))).toBe(true);
      } else {
        const dir = path.join(ROOT, skill);
        expect(fs.existsSync(dir), `${skill} declared in SKILLS but ${dir} missing`).toBe(
          true,
        );
        expect(fs.statSync(dir).isDirectory()).toBe(true);
      }
    }
  });

  test("/issue-forensics is in the SKILLS array", () => {
    const setupContent = fs.readFileSync(path.join(ROOT, "setup"), "utf-8");
    const match = setupContent.match(/^SKILLS=\((.*?)\)$/m);
    expect(match).not.toBeNull();
    const declared = match![1]
      .split(/\s+/)
      .map((s) => s.replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    expect(declared).toContain("issue-forensics");
  });
});
