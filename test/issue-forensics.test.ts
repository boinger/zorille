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

describe("/issue-forensics v0.1.2 — disclosure-path check (Phase 5.5)", () => {
  /**
   * Structural tests for the v0.1.2 additions: Phase 5.5 disclosure-path
   * probe, security-shape classification, three new flags, full-SHA Pillar 1
   * gate, filename guardrail, halt-and-ask on probing-blocked. These are
   * all documentation tests — they verify Phase 5.5 is documented, not that
   * it works. Behavioral tests would need an eval framework.
   */

  let skillContent: string;

  function loadSkill(): string {
    if (!skillContent) {
      skillContent = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf-8");
    }
    return skillContent;
  }

  test("SKILL.md contains Phase 5.5", () => {
    const c = loadSkill();
    expect(c).toMatch(/Phase 5\.5/);
    expect(c).toMatch(/Disclosure path check/i);
  });

  test("SKILL.md mentions the four-probe sequence", () => {
    const c = loadSkill();
    expect(c).toMatch(/community\/profile/);
    expect(c).toMatch(/SECURITY\.md/);
    expect(c).toMatch(/security\/advisories\/new/);
    expect(c).toMatch(/security\.txt/);
    expect(c).toMatch(/CONTRIBUTING\.md/);
  });

  test("SKILL.md does NOT use the broken admin-auth PVR probe", () => {
    // The /private-vulnerability-reporting --jq .enabled API requires
    // admin auth and silently 403s for external investigators. v0.1.2
    // replaced it with the security/advisories/new UI-scrape detection.
    const c = loadSkill();
    expect(c).not.toMatch(/private-vulnerability-reporting\s+--jq\s+\.enabled/);
  });

  test("SKILL.md documents delivery-path branching", () => {
    const c = loadSkill();
    expect(c).toMatch(/RESPONSIBLE DISCLOSURE/);
    expect(c).toMatch(/responsible disclosure (takes precedence|beats anti-squatting)/i);
  });

  test("SKILL.md documents the --security flag", () => {
    const c = loadSkill();
    expect(c).toMatch(/--security\b[^-]/); // --security but not --security-something
  });

  test("SKILL.md documents the --not-security flag", () => {
    const c = loadSkill();
    expect(c).toMatch(/--not-security/);
  });

  test("SKILL.md documents the --probe-web flag with opt-in rationale", () => {
    const c = loadSkill();
    expect(c).toMatch(/--probe-web/);
    // Rationale must be present so future maintainers know why it's opt-in.
    expect(c).toMatch(/(telegraph|web logs|opt-in)/i);
  });

  test("SKILL.md documents the Pillar 4 mid-trigger for re-classification", () => {
    const c = loadSkill();
    expect(c).toMatch(/Pillar 4 surfaced/);
    // The three-option prompt language must be present.
    expect(c).toMatch(/responsible-disclosure posture/i);
  });

  test("SKILL.md documents the Phase 5.5 re-evaluation safety net", () => {
    const c = loadSkill();
    expect(c).toMatch(/Re-evaluation/i);
    expect(c).toMatch(/Pillar evidence shifted classification/i);
  });

  test("SKILL.md documents homepage + org-blog inference for probe #3", () => {
    const c = loadSkill();
    // No-TLD-guessing rule: must use repo homepage field, fall back to org blog.
    expect(c).toMatch(/repos\/<owner>\/<repo>\s*--jq\s*\.homepage/);
    expect(c).toMatch(/orgs\/<owner>\s*--jq\s*\.blog/);
    expect(c).toMatch(/SKIP probe #3/);
  });

  test("SKILL.md documents probe failure handling", () => {
    const c = loadSkill();
    expect(c).toMatch(/probe_errors/);
    expect(c).toMatch(/probing blocked/i);
  });

  test("SKILL.md documents Expires field handling for security.txt", () => {
    const c = loadSkill();
    expect(c).toMatch(/Expires/);
    expect(c).toMatch(/(stale|expired)/i);
  });

  test("SKILL.md annotates probe #2 as relying on unofficial GitHub UI", () => {
    const c = loadSkill();
    // Must call out that PVR detection is not a stable API contract.
    expect(c).toMatch(/(unofficial|GitHub may have changed|published JSON API contract)/i);
  });

  test("SKILL.md documents the cached-URL fallthrough for probe #1", () => {
    const c = loadSkill();
    // Must handle the case where community/profile returns a stale URL.
    expect(c).toMatch(/Cached-URL/);
    expect(c).toMatch(/(404s when followed|fall through to)/i);
  });

  test("SKILL.md documents HALT behavior for security_shaped + all-errored", () => {
    const c = loadSkill();
    expect(c).toMatch(/All four disclosure probes errored/);
    expect(c).toMatch(/Manually specify disclosure path/);
    // Must explicitly halt rather than silently default to public.
    expect(c).toMatch(/HALT|do NOT silently default/i);
  });

  test("SKILL.md documents Pillar 4 mid-trigger respects --not-security", () => {
    const c = loadSkill();
    // Pillar 4 mid-trigger must NOT re-prompt when user has overridden.
    expect(c).toMatch(/(respects[^.]*--not-security|--not-security[^.]*respect)/i);
  });

  test("SKILL.md documents filename suffix as primary guardrail", () => {
    const c = loadSkill();
    expect(c).toMatch(/\.private-draft\.md/);
    expect(c).toMatch(/(primary guardrail|paste-strippable)/i);
  });

  test("SKILL.md Phase 7 schema includes security_shaped field", () => {
    const c = loadSkill();
    expect(c).toMatch(/^security_shaped:\s*<yes\|no\|unknown>/m);
  });

  test("SKILL.md Phase 7 schema includes disclosure block", () => {
    const c = loadSkill();
    expect(c).toMatch(/^disclosure:/m);
    expect(c).toMatch(/chosen_path:/);
    expect(c).toMatch(/probe_errors:/);
  });

  test("Pillar 1 explicitly requires FULL 40-character SHAs", () => {
    const c = loadSkill();
    expect(c).toMatch(/FULL 40-character SHA/);
    expect(c).toMatch(/Abbreviated SHAs/);
    expect(c).toMatch(/forbidden/);
  });

  test("Quality checklist Rigor section includes the full-SHA item", () => {
    const c = loadSkill();
    // The full-SHA constraint must appear in the Rigor checklist, not just Pillar 1.
    expect(c).toMatch(/All permalinks use the FULL 40-character SHA/);
  });

  test("Pillar 1 mentions git rev-parse as the recovery pattern", () => {
    const c = loadSkill();
    // When starting from short SHAs in git log output, must recover full form.
    expect(c).toMatch(/git rev-parse <short-sha>/);
  });

  test("SKILL.md frontmatter version matches VERSION file (0.1.3)", () => {
    const version = fs
      .readFileSync(path.join(SKILL_DIR, "VERSION"), "utf-8")
      .trim();
    expect(version).toBe("0.1.3");
    const c = loadSkill();
    expect(c).toMatch(/^version:\s*0\.1\.3\s*$/m);
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
