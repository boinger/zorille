import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";

const ROOT = path.resolve(__dirname, "..");
const SLUG_SCRIPT = path.join(ROOT, "lib", "slug.sh");

/**
 * lib/slug.sh is a load-bearing contract: both skills must compute the same
 * slug for the same repo so /plan-fixes's auto-discovery can locate the
 * baseline /codebase-audit just wrote. Enforced against fixture URLs.
 */

function runSlug(cwd: string): string {
  const r = spawnSync("bash", [SLUG_SCRIPT], { cwd, encoding: "utf-8" });
  if (r.status !== 0) {
    throw new Error(`slug.sh exited ${r.status}: ${r.stderr}`);
  }
  return r.stdout.trim();
}

function makeRepo(remoteUrl: string | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "slug-contract-"));
  spawnSync("git", ["init", "-q"], { cwd: dir });
  if (remoteUrl !== null) {
    spawnSync("git", ["remote", "add", "origin", remoteUrl], { cwd: dir });
  }
  return dir;
}

describe("slug derivation contract (lib/slug.sh)", () => {
  const tempDirs: string[] = [];

  afterAll(() => {
    for (const d of tempDirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  test("script exists and is executable", () => {
    expect(fs.existsSync(SLUG_SCRIPT)).toBe(true);
    const mode = fs.statSync(SLUG_SCRIPT).mode;
    expect(mode & 0o100).toBeTruthy(); // owner execute bit
  });

  test("SSH URL with .git suffix", () => {
    const d = makeRepo("git@github.com:org/repo.git");
    tempDirs.push(d);
    expect(runSlug(d)).toBe("org-repo");
  });

  test("HTTPS URL with .git suffix", () => {
    const d = makeRepo("https://github.com/org/repo.git");
    tempDirs.push(d);
    expect(runSlug(d)).toBe("org-repo");
  });

  test("HTTPS URL without .git suffix", () => {
    const d = makeRepo("https://github.com/org/repo");
    tempDirs.push(d);
    expect(runSlug(d)).toBe("org-repo");
  });

  test("multi-segment path takes last two segments", () => {
    const d = makeRepo("https://gitlab.example.com/group/subgroup/repo.git");
    tempDirs.push(d);
    expect(runSlug(d)).toBe("subgroup-repo");
  });

  test("no remote falls back to basename of repo root", () => {
    const d = makeRepo(null);
    tempDirs.push(d);
    const expectedBasename = path.basename(d);
    expect(runSlug(d)).toBe(expectedBasename);
  });

  test("both SKILL.md files invoke lib/slug.sh identically", () => {
    const cbaSkill = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");
    const pfSkillPath = path.join(ROOT, "plan-fixes", "SKILL.md");

    // /plan-fixes SKILL.md may not exist yet during staged development.
    // When it does exist, both files must contain the same invocation pattern.
    if (fs.existsSync(pfSkillPath)) {
      const pfSkill = fs.readFileSync(pfSkillPath, "utf-8");
      // Both preambles must invoke slug.sh via $LIB_DIR (skill install dir),
      // not $REPO_ROOT (audit target).
      const pattern = /bash\s+["']?\$\{?LIB_DIR\}?\/slug\.sh["']?/;
      expect(cbaSkill).toMatch(pattern);
      expect(pfSkill).toMatch(pattern);
    } else {
      // Staged: codebase-audit must still reference the script.
      expect(cbaSkill).toMatch(/lib\/slug\.sh/);
    }
  });
});
