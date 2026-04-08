import { describe, test, expect, afterAll } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";

const ROOT = path.resolve(__dirname, "..");
const PROBE_SCRIPT = path.join(ROOT, "lib", "probe-exists.sh");

/**
 * Sentinel-file probing is a load-bearing contract between /codebase-audit
 * and /plan-fixes (and any future sibling skills). The shared script must
 * always exit 0, print only files that exist, and handle edge cases
 * (spaces, directories, broken symlinks, zero args) without failing.
 *
 * This test mirrors test/slug-contract.test.ts structure. v1.9.1 introduced
 * both contract scripts in lib/ after the v1.9.0 experience showed that
 * inline bash patterns in SKILL.md get paraphrased by the LLM and drift
 * from canonical form. Named executable scripts resist paraphrase better.
 */

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runProbe(args: string[], cwd: string): RunResult {
  const r = spawnSync("bash", [PROBE_SCRIPT, ...args], {
    cwd,
    encoding: "utf-8",
  });
  return {
    exitCode: r.status ?? -1,
    stdout: r.stdout,
    stderr: r.stderr,
  };
}

describe("probe-exists.sh contract (lib/probe-exists.sh)", () => {
  const tempDirs: string[] = [];

  afterAll(() => {
    for (const d of tempDirs) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  function makeFixtureDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "probe-contract-"));
    tempDirs.push(d);
    return d;
  }

  // --- Script metadata (2 assertions) ---

  test("script exists and is executable", () => {
    expect(fs.existsSync(PROBE_SCRIPT)).toBe(true);
    const mode = fs.statSync(PROBE_SCRIPT).mode;
    expect(mode & 0o100).toBeTruthy(); // owner execute bit
  });

  test("script has set -euo pipefail and always-exit-0 contract in header", () => {
    const content = fs.readFileSync(PROBE_SCRIPT, "utf-8");
    expect(content).toContain("set -euo pipefail");
    expect(content).toContain("ALWAYS exits 0");
    // Matches the lib/slug.sh convention of a load-bearing-contract header.
    expect(content).toMatch(/load-bearing contract/i);
  });

  // --- Behavioral fixtures (7 assertions) ---

  test("happy path: all files exist → prints each, exits 0", () => {
    const dir = makeFixtureDir();
    fs.writeFileSync(path.join(dir, "pyproject.toml"), "");
    fs.writeFileSync(path.join(dir, "Makefile"), "");
    fs.writeFileSync(path.join(dir, "README.md"), "");

    const r = runProbe(["pyproject.toml", "Makefile", "README.md"], dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim().split("\n").sort()).toEqual([
      "Makefile",
      "README.md",
      "pyproject.toml",
    ]);
  });

  test("no files exist → no stdout, exits 0 (silent success)", () => {
    const dir = makeFixtureDir();
    const r = runProbe(["missing-a", "missing-b", "missing-c"], dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe("");
  });

  test("mixed: some exist, some missing → only existing paths printed, exits 0", () => {
    const dir = makeFixtureDir();
    fs.writeFileSync(path.join(dir, "pyproject.toml"), "");
    // Makefile and Dockerfile intentionally absent

    const r = runProbe(
      ["pyproject.toml", "Makefile", "Dockerfile", "README.md"],
      dir,
    );
    expect(r.exitCode).toBe(0);
    // Only pyproject.toml should be printed
    const lines = r.stdout.trim().split("\n").filter((l) => l.length > 0);
    expect(lines).toEqual(["pyproject.toml"]);
  });

  test("file with spaces in name → quoted correctly, exits 0", () => {
    const dir = makeFixtureDir();
    fs.writeFileSync(path.join(dir, "file with space.txt"), "");

    const r = runProbe(["file with space.txt"], dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe("file with space.txt");
  });

  test("directory (not a regular file) → still counts as exists", () => {
    const dir = makeFixtureDir();
    fs.mkdirSync(path.join(dir, "subdir"));
    fs.mkdirSync(path.join(dir, ".github"));
    fs.mkdirSync(path.join(dir, ".github/workflows"));

    const r = runProbe(["subdir", ".github/workflows", "missing"], dir);
    expect(r.exitCode).toBe(0);
    const lines = r.stdout.trim().split("\n").filter((l) => l.length > 0).sort();
    expect(lines).toEqual([".github/workflows", "subdir"]);
  });

  test("broken symlink → [ -e ] returns false, symlink NOT printed", () => {
    const dir = makeFixtureDir();
    // Create a symlink to a nonexistent target
    fs.symlinkSync("/nonexistent/target", path.join(dir, "broken-link"));
    // And a real file for comparison
    fs.writeFileSync(path.join(dir, "real-file"), "");

    const r = runProbe(["broken-link", "real-file"], dir);
    expect(r.exitCode).toBe(0);
    // Only real-file should be printed; broken-link should NOT appear
    // because `[ -e broken-link ]` returns false when the target is missing.
    const lines = r.stdout.trim().split("\n").filter((l) => l.length > 0);
    expect(lines).toEqual(["real-file"]);
  });

  test("zero arguments → no stdout, exits 0", () => {
    const dir = makeFixtureDir();
    const r = runProbe([], dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe("");
  });

  // --- Cross-SKILL.md grep contract (1 assertion) ---

  test("SKILL.md preamble and Phase 1.2 both reference lib/probe-exists.sh", () => {
    // The whole point of extracting this script is to make the canonical
    // invocation transmit reliably to the LLM. That requires the invocation
    // to appear in BOTH the preamble (high-attention area) AND Phase 1.2
    // (the actual probe site). A regression that drops either reference
    // would fall back to paraphrase-prone inline code.
    const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

    const preamble = skillMd.match(/## Preamble[\s\S]*?(?=\n## )/)?.[0] ?? "";
    expect(preamble).toContain("lib/probe-exists.sh");

    const phase12 = skillMd.match(/### 1\.2 [\s\S]*?(?=\n### )/)?.[0] ?? "";
    expect(phase12).toMatch(
      /bash\s+["']?\$\{?REPO_ROOT\}?\/lib\/probe-exists\.sh/,
    );
  });
});
