import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";

/**
 * Exercises the Phase 4.4 baseline-hash pattern. Asserts that finding `id`
 * fields are real SHA-256 hex (not literal `$(echo ...)` strings) and that
 * hashes are stable across runs even when titles contain `$`-prefixed
 * substrings that an unquoted heredoc would env-expand.
 */

const ROOT = path.resolve(__dirname, "..");
const SKILL_MD = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

// Builds a minimal script mirroring the Phase 4.4 pattern (tool fallback,
// compute-first, single-quoted heredoc + sed, integrity guard) without
// extracting the SKILL.md example verbatim — keeps this test decoupled from
// prose edits. Structural validation lives in skill-validation.test.ts.
function buildPhase44TestScript(outputPath: string): string {
  // Fixture title contains a literal `$PATH` to catch heredoc env-expansion.
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
    // Single-quoted heredoc keeps `$PATH` literal in the output. An unquoted
    // heredoc would expand it to the caller's PATH env var and fail this
    // assertion.
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
