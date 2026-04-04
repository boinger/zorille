import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("E2E: Checklist regex patterns are syntactically valid", () => {
  const checklist = fs.readFileSync(path.join(ROOT, "checklist.md"), "utf-8");
  const patterns = fs.readFileSync(
    path.join(ROOT, "references", "patterns.md"),
    "utf-8",
  );

  // Extract regex patterns from markdown: lines containing ` — ` with backtick-wrapped content
  function extractPatterns(content: string): { pattern: string; label: string }[] {
    const results: { pattern: string; label: string }[] = [];
    for (const line of content.split("\n")) {
      // Match lines like: - **Title** — `regex` — Description
      // or: Regex: `pattern`
      const inlineMatch = line.match(/[—–-]\s*`([^`]+)`\s*[—–-]/);
      if (inlineMatch) {
        results.push({ pattern: inlineMatch[1], label: line.trim().slice(0, 80) });
        continue;
      }
      const regexLine = line.match(/^Regex:\s*`([^`]+)`/);
      if (regexLine) {
        results.push({ pattern: regexLine[1], label: line.trim().slice(0, 80) });
      }
    }
    return results;
  }

  const checklistPatterns = extractPatterns(checklist);
  const referencePatterns = extractPatterns(patterns);

  test("checklist.md has extractable patterns", () => {
    expect(checklistPatterns.length).toBeGreaterThanOrEqual(5);
  });

  test("patterns.md has extractable patterns", () => {
    expect(referencePatterns.length).toBeGreaterThan(5);
  });

  for (const { pattern, label } of checklistPatterns) {
    test(`checklist pattern compiles: ${label.slice(0, 60)}`, () => {
      expect(() => new RegExp(pattern)).not.toThrow();
    });
  }

  for (const { pattern, label } of referencePatterns) {
    // Skip ripgrep-specific syntax (e.g., (?i) inline flags) that isn't valid JS regex
    const hasRgOnlySyntax = /\(\?[imsx]/.test(pattern);
    test(`reference pattern compiles: ${label.slice(0, 60)}`, () => {
      if (hasRgOnlySyntax) {
        // Strip the (?i) flag and test the rest — ensures the core pattern is valid
        const stripped = pattern.replace(/\(\?[imsx]\)/g, "");
        expect(() => new RegExp(stripped)).not.toThrow();
      } else {
        expect(() => new RegExp(pattern)).not.toThrow();
      }
    });
  }
});

describe("E2E: Report template has required sections", () => {
  const template = fs.readFileSync(
    path.join(ROOT, "report-template.md"),
    "utf-8",
  );

  const requiredSections = [
    "Health Score",
    "Executive Summary",
    "Architecture Overview",
    "Summary Table",
    "Top 5 Priorities",
    "Findings",
  ];

  for (const section of requiredSections) {
    test(`report template contains "${section}"`, () => {
      expect(template).toContain(section);
    });
  }
});

describe("E2E: SKILL.md references all supporting files", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

  test("references checklist.md", () => {
    expect(skillMd).toContain("checklist.md");
  });

  test("references patterns.md", () => {
    expect(skillMd).toContain("patterns.md");
  });

  test("references report-template.md", () => {
    expect(skillMd).toContain("report-template.md");
  });

  test("references baseline.json", () => {
    expect(skillMd).toContain("baseline.json");
  });
});

describe("E2E: Quick-fix documentation completeness", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

  test("quick-fix has dirty working tree handling", () => {
    expect(skillMd).toContain("git status --porcelain");
  });

  test("quick-fix has commit proposal with AskUserQuestion", () => {
    expect(skillMd).toContain("Commit with this message");
  });

  test("quick-fix documents same-file re-read requirement", () => {
    expect(skillMd).toContain(
      "re-Read the file before attempting the next",
    );
  });

  test("report template supports quick-fix section", () => {
    const template = fs.readFileSync(
      path.join(ROOT, "report-template.md"),
      "utf-8",
    );
    expect(template).toContain("Quick Fix Results");
  });
});
