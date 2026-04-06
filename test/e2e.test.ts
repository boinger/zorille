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

  test("fix modes are suggested when not used but applicable", () => {
    // Nudge when neither flag was used
    expect(skillMd).toContain("--suggest-fixes` for inline fix diffs");
    expect(skillMd).toContain("--quick-fix` to auto-apply the safe ones");
    // Nudge when suggest-fixes was used but quick-fix was not
    expect(skillMd).toContain(
      "could be auto-applied with `/codebase-audit --quick-fix`",
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

describe("E2E: Changed-only documentation completeness", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

  test("changed-only uses git diff for file list", () => {
    expect(skillMd).toContain("git diff --name-only --diff-filter=ACMR");
  });

  test("changed-only uses merge-base for default ref", () => {
    expect(skillMd).toContain("git merge-base HEAD");
  });

  test("changed-only has >20 file threshold for grep strategy", () => {
    expect(skillMd).toContain("20 changed files");
  });

  test("changed-only documents binary file handling", () => {
    expect(skillMd).toContain(
      "Binary files in the changed list will be silently skipped",
    );
  });

  test("changed-only nudge exists for full audits", () => {
    expect(skillMd).toContain(
      "--changed-only` to audit only files changed on this branch",
    );
  });

  test("report template supports changed-only scope section", () => {
    const template = fs.readFileSync(
      path.join(ROOT, "report-template.md"),
      "utf-8",
    );
    expect(template).toContain("CHANGED_ONLY_SECTION");
    expect(template).toContain("This is a scoped audit");
  });
});

describe("E2E: CI/JSON mode documentation completeness", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

  test("JSON schema fields are documented", () => {
    expect(skillMd).toContain("schema_version");
    expect(skillMd).toContain("tool_version");
    expect(skillMd).toContain("duration_seconds");
    expect(skillMd).toContain("findings_count");
    expect(skillMd).toContain("ignored_flags");
  });

  test("exit codes are documented", () => {
    expect(skillMd).toContain("exit 0");
    expect(skillMd).toContain("exit 1");
  });

  test("fail-on-regression is documented", () => {
    expect(skillMd).toContain("--fail-on-regression");
  });

  test("fail-on-new is documented", () => {
    expect(skillMd).toContain("--fail-on-new");
  });

  test("CI JSON is built from baseline.json", () => {
    expect(skillMd).toContain(
      "Read the baseline written in Phase 4.4",
    );
  });

  test("min-severity filter is documented", () => {
    expect(skillMd).toContain("--min-severity");
    expect(skillMd).toContain(
      "Does NOT affect health score calculation",
    );
  });

  test("exit code limitation is documented", () => {
    expect(skillMd).toContain(
      "exits the Bash subprocess, not the Claude Code session",
    );
  });
});

describe("E2E: report template supports CI mode", () => {
  test("report template mode field mentions --ci", () => {
    const template = fs.readFileSync(
      path.join(ROOT, "report-template.md"),
      "utf-8",
    );
    expect(template).toContain("--ci");
  });
});

describe("E2E: SARIF format documentation completeness", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

  test("SARIF schema structure is documented", () => {
    expect(skillMd).toContain('"version": "2.1.0"');
    expect(skillMd).toContain("tool.driver.rules");
    expect(skillMd).toContain("ruleId");
    expect(skillMd).toContain("physicalLocation");
  });

  test("severity mapping is documented", () => {
    expect(skillMd).toContain('`"error"`');
    expect(skillMd).toContain('`"warning"`');
    expect(skillMd).toContain('`"note"`');
    expect(skillMd).toContain("security-severity");
  });

  test("rule ID construction is documented", () => {
    expect(skillMd).toContain("{category}/{kebab-title}");
  });

  test("file path normalization is documented", () => {
    expect(skillMd).toContain("uriBaseId");
    expect(skillMd).toContain("%SRCROOT%");
    expect(skillMd).toContain("forward slashes only");
  });

  test("message structure separates title from recommendation", () => {
    expect(skillMd).toContain("finding title only");
    expect(skillMd).toContain("fullDescription");
  });

  test("SARIF composes with CI mode", () => {
    expect(skillMd).toContain("--ci --format sarif");
  });

  test("invalid format value is handled", () => {
    expect(skillMd).toContain("Unsupported format");
  });

  test("report template supports --format sarif", () => {
    const template = fs.readFileSync(
      path.join(ROOT, "report-template.md"),
      "utf-8",
    );
    expect(template).toContain("--format sarif");
  });
});

describe("E2E: Infrastructure checklist", () => {
  test("references/infra-checklist.md exists and has content", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "references", "infra-checklist.md"),
      "utf-8",
    );
    expect(content.length).toBeGreaterThan(50);
  });

  test("infra checklist has [QUICK] tagged patterns", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "references", "infra-checklist.md"),
      "utf-8",
    );
    expect(content).toContain("[QUICK]");
  });

  test("infra checklist has Infrastructure category", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "references", "infra-checklist.md"),
      "utf-8",
    );
    expect(content).toContain("### Infrastructure");
  });

  test("infra checklist patterns compile as valid regex", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "references", "infra-checklist.md"),
      "utf-8",
    );
    const patterns: { pattern: string; label: string }[] = [];
    for (const line of content.split("\n")) {
      const match = line.match(/[—–-]\s*`([^`]+)`\s*[—–-]/);
      if (match) {
        patterns.push({ pattern: match[1], label: line.trim().slice(0, 80) });
      }
    }
    expect(patterns.length).toBeGreaterThanOrEqual(10);
    for (const { pattern, label } of patterns) {
      const hasRgOnlySyntax = /\(\?[imsx]/.test(pattern);
      if (hasRgOnlySyntax) {
        const stripped = pattern.replace(/\(\?[imsx]\)/g, "");
        expect(() => new RegExp(stripped)).not.toThrow();
      } else {
        expect(() => new RegExp(pattern)).not.toThrow();
      }
    }
  });
});
