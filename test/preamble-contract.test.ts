import { describe, test, expect, afterAll } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";

/**
 * Behavioral test for the SKILL.md preamble bash block.
 *
 * Why this test exists (read this before deleting):
 *
 * v1.9.0 shipped lib/slug.sh as a shared contract between /codebase-audit
 * and /plan-fixes. v1.9.1 added lib/probe-exists.sh the same way. Both
 * SKILL.md preambles invoked the scripts via `$REPO_ROOT/lib/<script>.sh`,
 * where $REPO_ROOT comes from `git rev-parse --show-toplevel` — i.e., the
 * git root of the audit TARGET, not the skill's install directory. For any
 * audit target that wasn't codebase-audit itself, neither script was
 * reachable. slug.sh silently fell back to `basename $REPO_ROOT`, producing
 * non-canonical slugs. probe-exists.sh had no bash-level fallback; the LLM
 * started defensively hedging with `|| ls <guessed files>` which
 * cascade-cancelled when the guesses didn't pan out.
 *
 * Both bugs shipped because the existing contract tests
 * (test/slug-contract.test.ts and test/probe-exists-contract.test.ts)
 * invoke the scripts via absolute paths (`path.join(ROOT, "lib", ...)`)
 * and NEVER exercise the SKILL.md preamble's lookup path. The contract
 * tests verify the scripts work when invoked directly; they don't verify
 * the preamble can find them. That's the testing gap v1.9.2 closed.
 *
 * THIS test extracts the preamble bash block from SKILL.md by content
 * anchor (finding the fence starting with `LIB_DIR=`), executes it from
 * a temp directory that is NOT the codebase-audit repo, and asserts the
 * shared scripts actually resolve and run. It catches the exact class of
 * bug that escaped v1.9.0 and v1.9.1.
 *
 * DO NOT DELETE THIS FILE thinking it overlaps with slug-contract or
 * probe-exists-contract. Those tests verify the SCRIPTS work in isolation.
 * This test verifies the PREAMBLE can find and invoke them. They are
 * testing different things and both are load-bearing.
 */

const ROOT = path.resolve(__dirname, "..");
const CODEBASE_AUDIT_SKILL = path.join(ROOT, "SKILL.md");
const PLAN_FIXES_SKILL = path.join(ROOT, "plan-fixes", "SKILL.md");
const LIB_DIR = path.join(ROOT, "lib"); // Where the real scripts actually live

/**
 * Extract the preamble bash block from a SKILL.md file by content anchor.
 *
 * Strategy: find the bash fence whose opening `\`\`\`bash` is followed by
 * content containing `LIB_DIR=` as the canonical first-line marker. Match
 * from that opening fence to its closing fence.
 *
 * Why content anchor and not line range or heading anchor:
 *   - Line range breaks on any SKILL.md edit that shifts the preamble.
 *   - Heading anchor requires `## Preamble` to stay as a stable header.
 *   - Fence-regex fails if there are multiple bash blocks in the preamble
 *     area.
 * Content anchor (finding the fence that STARTS with LIB_DIR=) stays
 * resilient to surrounding edits as long as the preamble keeps LIB_DIR=
 * as its first real assignment. If that invariant breaks, this extractor
 * fails loudly and the implementer knows to re-verify transmission.
 */
function extractPreambleBash(skillMdPath: string): string {
  const content = fs.readFileSync(skillMdPath, "utf-8");
  // Find ```bash fence whose body starts with LIB_DIR= (possibly after
  // comment lines). Stop at the closing ``` fence.
  const match = content.match(
    /```bash\n((?:#[^\n]*\n)*LIB_DIR=[\s\S]*?)\n```/,
  );
  if (!match) {
    throw new Error(
      `Could not extract preamble bash block from ${skillMdPath}. ` +
        `Looking for a \`\`\`bash fence containing LIB_DIR= as its first ` +
        `non-comment line. If the preamble dropped LIB_DIR=, v1.9.2 ` +
        `transmission is broken — see test/preamble-contract.test.ts header.`,
    );
  }
  return match[1];
}

/**
 * Run the extracted preamble bash block against a fixture repo.
 * Returns the full result so tests can assert on exit code, stdout, stderr.
 */
function runPreambleInFixture(
  bashBlock: string,
  fixtureDir: string,
  libDirOverride: string,
): { exitCode: number; stdout: string; stderr: string } {
  // We wrap the extracted preamble in a shebang and set HOME so the
  // default $LIB_DIR resolves deterministically in the test environment.
  // Using CODEBASE_AUDIT_LIB_DIR to pin the lib path explicitly avoids
  // depending on where the user has codebase-audit installed.
  const script = `#!/usr/bin/env bash
set -uo pipefail
${bashBlock}
`;
  const scriptPath = path.join(fixtureDir, "run-preamble.sh");
  fs.writeFileSync(scriptPath, script);
  fs.chmodSync(scriptPath, 0o755);

  const r = spawnSync("bash", [scriptPath], {
    cwd: fixtureDir,
    encoding: "utf-8",
    env: {
      ...process.env,
      CODEBASE_AUDIT_LIB_DIR: libDirOverride,
      HOME: process.env.HOME ?? "/tmp", // keep a valid HOME for fallback
    },
  });
  return {
    exitCode: r.status ?? -1,
    stdout: r.stdout,
    stderr: r.stderr,
  };
}

/**
 * Create a fixture git repo that is NOT codebase-audit. Initializes git,
 * sets a fake remote URL, and creates a couple of sentinel files.
 */
function makeFixtureRepo(remoteUrl: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preamble-contract-"));
  spawnSync("git", ["init", "-q"], { cwd: dir });
  spawnSync("git", ["remote", "add", "origin", remoteUrl], { cwd: dir });
  // Create a few sentinel files so Phase 1.2 probing has something to find
  fs.writeFileSync(path.join(dir, "pyproject.toml"), "");
  fs.writeFileSync(path.join(dir, "Makefile"), "");
  // Deliberately NOT creating Dockerfile or package.json — the probe must
  // handle missing files cleanly
  return dir;
}

describe("SKILL.md preamble behavioral contract", () => {
  const tempDirs: string[] = [];

  afterAll(() => {
    for (const d of tempDirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  // --- Extraction tests (catch malformed preamble structure) ---

  test("can extract preamble bash block from codebase-audit SKILL.md", () => {
    const bash = extractPreambleBash(CODEBASE_AUDIT_SKILL);
    expect(bash).toContain("LIB_DIR=");
    expect(bash).toContain("CODEBASE_AUDIT_LIB_DIR");
    expect(bash).toContain("SLUG=");
  });

  test("can extract preamble bash block from plan-fixes SKILL.md", () => {
    const bash = extractPreambleBash(PLAN_FIXES_SKILL);
    expect(bash).toContain("LIB_DIR=");
    expect(bash).toContain("CODEBASE_AUDIT_LIB_DIR");
    expect(bash).toContain("SLUG=");
  });

  // --- Behavioral tests: run the preambles against a fixture ---

  test("codebase-audit preamble runs successfully in a non-codebase-audit repo", () => {
    const fixture = makeFixtureRepo("git@github.com:acme/widgets.git");
    tempDirs.push(fixture);
    const bash = extractPreambleBash(CODEBASE_AUDIT_SKILL);
    const result = runPreambleInFixture(bash, fixture, LIB_DIR);

    expect(result.exitCode).toBe(0);
    // Preamble should print BRANCH, SLUG, AUDIT_HOME (stdout discipline)
    expect(result.stdout).toContain("BRANCH:");
    expect(result.stdout).toContain("SLUG:");
    expect(result.stdout).toContain("AUDIT_HOME:");
    // CRITICAL: the SLUG must be canonical (from slug.sh) not the basename
    // fallback. Remote URL git@github.com:acme/widgets.git → acme-widgets.
    expect(result.stdout).toMatch(/SLUG: acme-widgets/);
    // And there must be NO stale-symlink warning (LIB_DIR exists in this test)
    expect(result.stderr).not.toContain("WARNING:");
  });

  test("plan-fixes preamble runs successfully in a non-codebase-audit repo", () => {
    const fixture = makeFixtureRepo("https://github.com/acme/gadgets.git");
    tempDirs.push(fixture);
    const bash = extractPreambleBash(PLAN_FIXES_SKILL);
    const result = runPreambleInFixture(bash, fixture, LIB_DIR);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/SLUG: acme-gadgets/);
    expect(result.stderr).not.toContain("WARNING:");
  });

  test("probe-exists.sh resolves via $LIB_DIR after preamble runs", () => {
    // Run the preamble, then invoke probe-exists.sh the way Phase 1.2 does,
    // using the same $LIB_DIR the preamble established. This is the end-to-end
    // test that ties Phase 1.2's probe invocation to the preamble's LIB_DIR
    // definition.
    const fixture = makeFixtureRepo("git@github.com:acme/widgets.git");
    tempDirs.push(fixture);
    const bash = extractPreambleBash(CODEBASE_AUDIT_SKILL);
    // Append a probe invocation after the preamble
    const scriptWithProbe =
      bash +
      `\nbash "$LIB_DIR/probe-exists.sh" pyproject.toml Makefile Dockerfile package.json\n`;
    const scriptPath = path.join(fixture, "run-with-probe.sh");
    fs.writeFileSync(scriptPath, `#!/usr/bin/env bash\nset -uo pipefail\n${scriptWithProbe}\n`);
    fs.chmodSync(scriptPath, 0o755);

    const r = spawnSync("bash", [scriptPath], {
      cwd: fixture,
      encoding: "utf-8",
      env: {
        ...process.env,
        CODEBASE_AUDIT_LIB_DIR: LIB_DIR,
      },
    });

    expect(r.status).toBe(0);
    // probe-exists.sh should emit only the files that actually exist.
    // pyproject.toml and Makefile were created by makeFixtureRepo; Dockerfile
    // and package.json were not.
    const probeOutput = r.stdout
      .split("\n")
      .filter((l) => l && !l.startsWith("BRANCH:") && !l.startsWith("SLUG:") && !l.startsWith("AUDIT_HOME:"));
    expect(probeOutput).toContain("pyproject.toml");
    expect(probeOutput).toContain("Makefile");
    expect(probeOutput).not.toContain("Dockerfile");
    expect(probeOutput).not.toContain("package.json");
  });

  test("stale-symlink warning fires when LIB_DIR does not exist", () => {
    // Point CODEBASE_AUDIT_LIB_DIR at a path that definitely doesn't exist.
    // The preamble should print a WARNING to stderr, fall back to basename
    // for SLUG (because slug.sh can't be found), and still exit 0.
    const fixture = makeFixtureRepo("git@github.com:acme/widgets.git");
    tempDirs.push(fixture);
    const bash = extractPreambleBash(CODEBASE_AUDIT_SKILL);
    const result = runPreambleInFixture(
      bash,
      fixture,
      "/tmp/definitely-does-not-exist-lib-dir",
    );

    expect(result.exitCode).toBe(0);
    // WARNING fires on stderr
    expect(result.stderr).toContain("WARNING:");
    expect(result.stderr).toContain("does not exist");
    // SLUG falls back to basename of $REPO_ROOT (the fixture temp dir name)
    const slugLine = result.stdout
      .split("\n")
      .find((l) => l.startsWith("SLUG:"));
    expect(slugLine).toBeDefined();
    expect(slugLine).toContain(path.basename(fixture));
  });

  test("env var override works: custom LIB_DIR is used instead of default", () => {
    // Copy slug.sh to a custom location, point CODEBASE_AUDIT_LIB_DIR at it,
    // and verify the preamble uses the custom path instead of the default.
    const customLibDir = fs.mkdtempSync(path.join(os.tmpdir(), "custom-lib-"));
    tempDirs.push(customLibDir);
    fs.copyFileSync(
      path.join(LIB_DIR, "slug.sh"),
      path.join(customLibDir, "slug.sh"),
    );
    fs.chmodSync(path.join(customLibDir, "slug.sh"), 0o755);

    const fixture = makeFixtureRepo("git@github.com:acme/widgets.git");
    tempDirs.push(fixture);
    const bash = extractPreambleBash(CODEBASE_AUDIT_SKILL);
    const result = runPreambleInFixture(bash, fixture, customLibDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/SLUG: acme-widgets/);
    expect(result.stderr).not.toContain("WARNING:");
  });
});
