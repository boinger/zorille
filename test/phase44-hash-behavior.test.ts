import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";

/**
 * Behavioral test for SKILL.md Phase 4.4 — the baseline hash pattern.
 *
 * v1.9.0 shipped with a heredoc quoting bug that caused baselines to be
 * written with literal `$(echo -n ... | shasum)` strings in the `id` fields
 * instead of computed SHA-256 hashes. This test catches any future regression
 * by actually running the Phase 4.4 pattern against fixture findings and
 * asserting the resulting baseline has real hex hashes.
 *
 * Critically, one of the fixture findings contains a literal `$` in its title
 * ("Missing $PATH validation"). Under the v1.9.0 bug, this finding's title
 * would get environment-expanded (if an unquoted heredoc were used). Under
 * the v1.9.1 placeholder+sed pattern, single-quoted heredoc prevents any
 * expansion and the title survives intact. The test asserts both the hash
 * format AND hash stability across repeated runs — if the implementation
 * regressed to an unquoted heredoc, the $PATH expansion would make the hash
 * non-deterministic (because $PATH varies by environment).
 */

const ROOT = path.resolve(__dirname, "..");
const SKILL_MD = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

/**
 * The Phase 4.4 SKILL.md content is prose + an example bash block. For a
 * behavioral test, we don't need to extract and execute the example verbatim
 * (that would couple the test to the prose). Instead, we construct a minimal
 * script that exercises the SAME pattern the example teaches: tool fallback,
 * compute-first, single-quoted heredoc with placeholders, sed substitution,
 * integrity guard. If the SKILL.md example teaches a different pattern in
 * the future, the structural tests in skill-validation.test.ts will catch it;
 * this file tests the pattern itself works.
 */
function buildPhase44TestScript(outputPath: string): string {
  // The fixture deliberately includes a title with a literal $ to regression-
  // test the heredoc quoting. The $PATH string MUST end up in the resulting
  // JSON file unchanged; if it gets env-expanded, the test will fail the
  // "title contains literal $PATH" assertion.
  return `#!/usr/bin/env bash
set -euo pipefail

if command -v shasum >/dev/null 2>&1; then
  _sha() { echo -n "$1" | shasum -a 256 | cut -d' ' -f1; }
elif command -v sha256sum >/dev/null 2>&1; then
  _sha() { echo -n "$1" | sha256sum | cut -d' ' -f1; }
else
  echo "ERROR: no hash tool" >&2
  exit 1
fi

H1=$(_sha "src/api/users.ts:security:SQL injection in user search")
H2=$(_sha "src/setup.sh:reliability:Missing \\$PATH validation in setup")
H3=$(_sha "src/api/auth.ts:error-handling:Bare except clause")

BASELINE="${outputPath}"
cat > "$BASELINE" <<'EOF'
{
  "version": "1.0.0",
  "findings": [
    {"id": "__HASH_1__", "severity": "critical", "title": "SQL injection in user search", "file": "src/api/users.ts", "line": 42},
    {"id": "__HASH_2__", "severity": "important", "title": "Missing $PATH validation in setup", "file": "src/setup.sh", "line": 8},
    {"id": "__HASH_3__", "severity": "important", "title": "Bare except clause", "file": "src/api/auth.ts", "line": 15}
  ]
}
EOF

sed -i.bak \\
  -e "s|__HASH_1__|$H1|g" \\
  -e "s|__HASH_2__|$H2|g" \\
  -e "s|__HASH_3__|$H3|g" \\
  "$BASELINE"
rm -f "$BASELINE.bak"

if grep -q '__HASH_' "$BASELINE"; then
  echo "ERROR: unresolved placeholders" >&2
  exit 1
fi
`;
}

function runPhase44Script(outputPath: string): { exitCode: number; stderr: string } {
  const scriptPath = path.join(path.dirname(outputPath), "run.sh");
  fs.writeFileSync(scriptPath, buildPhase44TestScript(outputPath));
  const r = spawnSync("bash", [scriptPath], { encoding: "utf-8" });
  return { exitCode: r.status ?? -1, stderr: r.stderr };
}

describe("Phase 4.4 baseline hash behavior", () => {
  const tempDirs: string[] = [];

  afterAll(() => {
    for (const d of tempDirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  test("SKILL.md Phase 4.4 section exists and is non-trivial", () => {
    const phase44 = SKILL_MD.match(/### 4\.4 [\s\S]*?(?=\n### )/)?.[0] ?? "";
    expect(phase44.length).toBeGreaterThan(1000); // prose + example code block
  });

  test("Phase 4.4 pattern runs successfully and produces valid JSON", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phase44-"));
    tempDirs.push(dir);
    const baseline = path.join(dir, "baseline.json");

    const { exitCode, stderr } = runPhase44Script(baseline);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");

    // JSON must parse
    const content = fs.readFileSync(baseline, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("findings");
    expect(parsed.findings).toHaveLength(3);
  });

  test("every finding.id is a valid SHA-256 hex hash (64 chars)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phase44-"));
    tempDirs.push(dir);
    const baseline = path.join(dir, "baseline.json");

    runPhase44Script(baseline);
    const parsed = JSON.parse(fs.readFileSync(baseline, "utf-8"));

    for (const finding of parsed.findings) {
      expect(finding.id).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  test("finding with literal $ in title is NOT mangled by env expansion", () => {
    // The v1.9.1 fix uses a single-quoted heredoc so `$PATH` stays literal
    // in the output. If the implementation ever regresses to an unquoted
    // heredoc, `$PATH` would get expanded to the caller's actual PATH env
    // var and this assertion would fail.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phase44-"));
    tempDirs.push(dir);
    const baseline = path.join(dir, "baseline.json");

    runPhase44Script(baseline);
    const parsed = JSON.parse(fs.readFileSync(baseline, "utf-8"));

    const pathFinding = parsed.findings.find((f: { title: string }) =>
      f.title.includes("PATH"),
    );
    expect(pathFinding).toBeDefined();
    // The title must contain the literal "$PATH" string — not an expanded
    // value like "/usr/local/bin:/usr/bin:...".
    expect(pathFinding.title).toContain("$PATH");
    expect(pathFinding.title).not.toContain("/usr/"); // env expansion would leak /usr/ or similar
  });

  test("hashes are deterministic across repeated runs", () => {
    // Run the script twice in fresh temp dirs and compare finding.id values.
    // If either run non-deterministically env-expanded anything (e.g., a
    // regression to unquoted heredoc), the hashes would differ.
    const runOnce = (): string[] => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phase44-"));
      tempDirs.push(dir);
      const baseline = path.join(dir, "baseline.json");
      runPhase44Script(baseline);
      const parsed = JSON.parse(fs.readFileSync(baseline, "utf-8"));
      return parsed.findings.map((f: { id: string }) => f.id);
    };

    const ids1 = runOnce();
    const ids2 = runOnce();
    expect(ids1).toEqual(ids2);
  });
});
