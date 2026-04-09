import { describe, test, expect, beforeEach } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";

/**
 * Regression test for the `./setup` self-symlink bug.
 *
 * Why this test exists (read this before deleting):
 *
 * `setup:48` and `action.yml:111` both call `ln -sf SRC DST`. When DST
 * already exists as a symlink to a directory (true on every run after the
 * first), both BSD `ln` (macOS) and GNU `ln` follow the symlink and create
 * a new link INSIDE the target directory, named after `basename(SRC)`.
 *
 * The first time around, this produced `plan-fixes/plan-fixes` strays
 * inside the repo. Commit `669c92e` deleted the symptom but never touched
 * `setup`, so the bug returned the next time setup ran. After the
 * codebase-audit → zorille rename, a second stray (`zorille/zorille`) also
 * became visible — same bug, different basename.
 *
 * Fix: `ln -sf` → `ln -sfn`. The `-n` flag tells `ln` not to dereference
 * the destination if it's a symlink to a directory.
 *
 * This test runs `./setup` twice in an isolated HOME and asserts both
 * (a) no strays appear inside the source dir AND (b) the correct symlinks
 * are installed at the expected paths. Without the positive assertions, a
 * future bug that made setup silently no-op would pass the test.
 */

const ROOT = path.resolve(__dirname, "..");

/**
 * Use lstat, NOT existsSync. existsSync follows symlinks — a self-symlink
 * `zorille/zorille → /Projects/zorille` resolves to a valid directory and
 * existsSync would return true regardless of whether the bug is present.
 * lstat stats the link itself.
 */
function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch (e: any) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
}

/**
 * Strays this test guards against. The repo-basename stray is intentionally
 * derived from `path.basename(ROOT)` rather than hardcoded to "zorille" —
 * the buggy `ln -sf` creates the stray named after `basename(SOURCE_DIR)`,
 * so this self-adjusts if the repo is cloned into a different directory
 * name (e.g. `zorille-v2/` for testing). Do not "fix" this to a literal.
 */
function strayPaths(): string[] {
  return [
    path.join(ROOT, "plan-fixes", "plan-fixes"),
    path.join(ROOT, path.basename(ROOT)),
  ];
}

/**
 * Pre-test guard, NOT a finally cleanup. We deliberately do NOT clean up
 * strays in finally — if the test fails because the regression came back,
 * we want the developer to be able to `ls -la` the actual stray that the
 * test caught. Auto-cleanup in finally would hide CI failure evidence,
 * which is exactly the failure mode that made commit 669c92e ineffective.
 *
 * Trade-off: a developer running this test locally and getting a failure
 * may need to `rm` strays once. That cost is worth the diagnostic value.
 */
function unlinkPreexistingStrays(): void {
  for (const p of strayPaths()) {
    if (isSymlink(p)) {
      try {
        fs.unlinkSync(p);
      } catch (e: any) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  }
}

function runSetup(tmpHome: string) {
  return spawnSync(path.join(ROOT, "setup"), [], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOME: tmpHome,
      // Prevent the second run's `git -C $SOURCE_DIR pull` from hanging on
      // credential prompts in CI.
      GIT_TERMINAL_PROMPT: "0",
    },
    encoding: "utf-8",
  });
}

function assertNoStrays(): void {
  for (const p of strayPaths()) {
    expect(isSymlink(p), `unexpected stray symlink at ${p}`).toBe(false);
  }
}

function assertInstallSymlinks(tmpHome: string): void {
  const cba = path.join(tmpHome, ".claude/skills/codebase-audit");
  const pf = path.join(tmpHome, ".claude/skills/plan-fixes");

  expect(isSymlink(cba), `missing install symlink at ${cba}`).toBe(true);
  expect(fs.readlinkSync(cba)).toBe(ROOT);

  expect(isSymlink(pf), `missing install symlink at ${pf}`).toBe(true);
  expect(fs.readlinkSync(pf)).toBe(path.join(ROOT, "plan-fixes"));
}

describe("setup: no self-symlink strays on re-run", () => {
  beforeEach(() => {
    // Clean up any strays left over from a previous failed run, BEFORE
    // running setup. See unlinkPreexistingStrays() for why we do this here
    // and not in finally.
    unlinkPreexistingStrays();
  });

  test("first and second ./setup runs leave no strays and install correct symlinks", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "zorille-setup-"));
    try {
      // Run 1: fresh HOME, install symlinks should not exist yet.
      const r1 = runSetup(tmpHome);
      expect(r1.status, `first run failed: ${r1.stderr}`).toBe(0);
      assertNoStrays();
      assertInstallSymlinks(tmpHome);

      // Run 2: install symlinks now exist as symlinks-to-directory. This is
      // the run that triggers the `ln -sf` footgun (the bug we're fixing).
      const r2 = runSetup(tmpHome);
      expect(r2.status, `second run failed: ${r2.stderr}`).toBe(0);
      assertNoStrays();
      assertInstallSymlinks(tmpHome);
    } finally {
      // tmpHome is throwaway scratch — clean it up unconditionally.
      // Strays in ROOT are NOT cleaned up here on purpose; see header.
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });
});
