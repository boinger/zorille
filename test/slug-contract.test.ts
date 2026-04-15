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

function runSlug(cwd: string, arg?: string): string {
  const args = arg !== undefined ? [SLUG_SCRIPT, arg] : [SLUG_SCRIPT];
  const r = spawnSync("bash", args, { cwd, encoding: "utf-8" });
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

  test("all SKILL.md files invoke lib/slug.sh identically", () => {
    // All skills that use slug.sh must invoke it via $LIB_DIR (skill install
    // dir), not $REPO_ROOT (audit target). /deps is exempt — pure-markdown
    // skill that doesn't use slug.sh.
    const pattern = /bash\s+["']?\$\{?LIB_DIR\}?\/slug\.sh["']?/;
    const skillPaths = [
      path.join(ROOT, "SKILL.md"), // /codebase-audit (repo root)
      path.join(ROOT, "plan-fixes", "SKILL.md"),
      path.join(ROOT, "issue-forensics", "SKILL.md"),
    ];

    for (const p of skillPaths) {
      // Allow staged development: if a SKILL.md doesn't exist yet (e.g.,
      // during a branch that hasn't added it), skip it. codebase-audit MUST
      // exist in any version.
      if (!fs.existsSync(p)) {
        // codebase-audit is mandatory
        if (p === path.join(ROOT, "SKILL.md")) {
          throw new Error(`/codebase-audit SKILL.md missing: ${p}`);
        }
        continue;
      }
      const content = fs.readFileSync(p, "utf-8");
      expect(content, `${p} does not invoke slug.sh via $LIB_DIR`).toMatch(
        pattern,
      );
    }
  });

  // URL-argument mode: used by /issue-forensics for investigation targets
  // that aren't cwd (e.g. investigating loki from a give-back workspace).
  // Zero-argument mode is unchanged for /codebase-audit and /plan-fixes.

  test("URL argument: SSH URL with .git suffix", () => {
    const d = makeRepo(null);
    tempDirs.push(d);
    expect(runSlug(d, "git@github.com:grafana/loki.git")).toBe("grafana-loki");
  });

  test("URL argument: HTTPS URL with .git suffix", () => {
    const d = makeRepo(null);
    tempDirs.push(d);
    expect(runSlug(d, "https://github.com/grafana/loki.git")).toBe(
      "grafana-loki",
    );
  });

  test("URL argument: HTTPS URL without .git suffix", () => {
    const d = makeRepo(null);
    tempDirs.push(d);
    expect(runSlug(d, "https://github.com/grafana/loki")).toBe("grafana-loki");
  });

  test("URL argument: multi-segment path takes last two segments", () => {
    const d = makeRepo(null);
    tempDirs.push(d);
    expect(runSlug(d, "https://gitlab.example.com/group/sub/repo.git")).toBe(
      "sub-repo",
    );
  });

  test("URL argument overrides cwd git remote", () => {
    // Make a repo with one remote, then invoke with a different URL.
    // The argument should win.
    const d = makeRepo("git@github.com:other/origin.git");
    tempDirs.push(d);
    expect(runSlug(d)).toBe("other-origin"); // zero-arg: derive from cwd
    expect(runSlug(d, "https://github.com/grafana/loki.git")).toBe(
      "grafana-loki",
    ); // with-arg: override
  });

  test("path argument: filesystem path uses basename", () => {
    const d = makeRepo(null);
    tempDirs.push(d);
    expect(runSlug(d, "/Users/someone/Projects/give-back")).toBe("give-back");
  });

  test("path argument: trailing slash does not break basename", () => {
    const d = makeRepo(null);
    tempDirs.push(d);
    expect(runSlug(d, "/tmp/somerepo/")).toBe("somerepo");
  });
});
