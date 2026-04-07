import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures");

describe("/plan-fixes documentation completeness", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

  test("baseline.json schema fields are documented", () => {
    for (const field of [
      "quick_fix_status",
      "severity",
      "category",
      "title",
      "file",
      "line",
      "has_suggested_fix",
    ]) {
      expect(skillMd).toContain(field);
    }
  });

  test("SARIF 2.1.0 field mapping is complete (10 fields)", () => {
    // All 10 rows from the mapping table
    const sources = [
      "runs[]",
      "level",
      "properties.tags",
      "message.text",
      "physicalLocation",
      "region.startLine",
      "fixes[]",
      "tool.driver.name",
      "ruleId",
      "codeFlows",
    ];
    for (const src of sources) {
      expect(skillMd).toContain(src);
    }
  });

  test("Option D coordination is documented with all 3 template variants", () => {
    expect(skillMd).toContain("plan-standard.md");
    expect(skillMd).toContain("plan-mixed.md");
    expect(skillMd).toContain("plan-applied.md");
    expect(skillMd).toContain("[ALREADY APPLIED]");
    expect(skillMd).toContain("Status column");
  });

  test("two-section menu (Action needed / Already applied) is documented", () => {
    expect(skillMd).toContain("Action needed");
    expect(skillMd).toContain("Already applied");
    expect(skillMd).toContain("--show-applied");
  });

  test("output path format is documented", () => {
    expect(skillMd).toContain("$AUDIT_HOME/$SLUG/plans/");
  });

  test("--from accepts both baseline.json and SARIF", () => {
    expect(skillMd).toContain("--from");
    expect(skillMd).toContain("auto-detect");
  });

  test("auto-discovery filters --changed-only baselines", () => {
    expect(skillMd).toContain("changed-only");
    expect(skillMd).toMatch(/filter|exclude/i);
  });

  test("auto-discovery prints path before proceeding", () => {
    expect(skillMd).toContain("Loading baseline:");
  });

  test("stale-baseline warning behavior documented", () => {
    expect(skillMd).toContain("commits behind HEAD");
  });

  test("empty-input behavior documented (no early exit for all-applied)", () => {
    expect(skillMd).toContain("do NOT exit early");
    expect(skillMd).toContain("canonical record");
  });

  test("slug-coupling documented as load-bearing contract", () => {
    expect(skillMd).toContain("lib/slug.sh");
    expect(skillMd).toMatch(/contract|load-bearing|shared/i);
  });

  test("path validation security rules documented", () => {
    expect(skillMd).toContain("file://");
    expect(skillMd).toContain("..");
    expect(skillMd).toContain("symlink");
    expect(skillMd).toContain("suffix");
  });

  test("LLM injection mitigation documented", () => {
    expect(skillMd).toContain("<untrusted-input>");
    expect(skillMd).toContain("truncat");
    expect(skillMd).toContain("markdown");
  });

  test("compression stat is documented for Phase 7", () => {
    expect(skillMd).toContain("Compressed");
    expect(skillMd).toMatch(/Generated.*plans from.*findings/);
  });

  test("fixture directory exists", () => {
    expect(fs.existsSync(FIXTURES)).toBe(true);
  });

  // Fixture validity — parse each JSON fixture
  const fixtureTests = [
    { file: "baseline-all-pending.json", schema: "baseline" },
    { file: "baseline-mixed-status.json", schema: "baseline" },
    { file: "baseline-all-applied.json", schema: "baseline" },
    { file: "baseline-mixed-quick-fix-statuses.json", schema: "baseline" },
    { file: "sarif-codeql-minimal.sarif", schema: "sarif" },
    { file: "sarif-eslint-edge-cases.sarif", schema: "sarif" },
    { file: "sarif-multi-tool.sarif", schema: "sarif" },
    { file: "sarif-malformed-traversal.sarif", schema: "sarif" },
    { file: "sarif-injection-attempt.sarif", schema: "sarif" },
    { file: "sarif-unknown-level.sarif", schema: "sarif" },
  ];

  for (const { file, schema } of fixtureTests) {
    test(`fixture ${file} exists and parses as valid ${schema}`, () => {
      const p = path.join(FIXTURES, file);
      expect(fs.existsSync(p)).toBe(true);
      const content = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(content);
      if (schema === "baseline") {
        expect(parsed).toHaveProperty("version");
        expect(parsed).toHaveProperty("findings");
        expect(Array.isArray(parsed.findings)).toBe(true);
      } else {
        expect(parsed).toHaveProperty("runs");
        expect(Array.isArray(parsed.runs)).toBe(true);
      }
    });
  }
});
