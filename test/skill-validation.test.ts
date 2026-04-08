import { describe, test, expect } from "bun:test";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("Skill structure validation", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

  test("SKILL.md exists and is non-empty", () => {
    expect(skillMd.length).toBeGreaterThan(100);
  });

  test("has valid YAML frontmatter", () => {
    expect(skillMd).toMatch(/^---\n/);
    expect(skillMd).toMatch(/\nname: codebase-audit\n/);
    const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf-8").trim();
    expect(skillMd).toContain(`version: ${version}`);
    expect(skillMd).toMatch(/\ndescription: \|/);
    expect(skillMd).toMatch(/\nallowed-tools:/);
  });

  test("has required sections", () => {
    const requiredSections = [
      "## Preamble",
      "## Phase 1: Orientation",
      "## Phase 2: Architecture Scan",
      "## Phase 3: Targeted Deep Dives",
      "## Phase 4: Report Generation",
      "## Edge Cases",
      "## Key Rules",
    ];
    for (const section of requiredSections) {
      expect(skillMd).toContain(section);
    }
  });

  test("has mode documentation", () => {
    expect(skillMd).toContain("--quick");
    expect(skillMd).toContain("--suggest-fixes");
    expect(skillMd).toContain("--quick-fix");
    expect(skillMd).toContain("--changed-only");
    expect(skillMd).toContain("Regression");
  });

  test("has Phase 5 for quick-fix", () => {
    expect(skillMd).toContain("## Phase 5: Quick Fix Application");
  });

  test("has changed-only file resolution step", () => {
    expect(skillMd).toContain("### 1.9 Changed-only file resolution");
  });

  test("changed-only skips Phase 2", () => {
    expect(skillMd).toContain("--changed-only` is active (architecture scan");
  });

  test("changed-only skips baseline generation", () => {
    expect(skillMd).toContain(
      "Skip baseline generation if `--changed-only` is active",
    );
  });

  test("quick-fix implies suggest-fixes", () => {
    expect(skillMd).toContain(
      "`--quick-fix` implies `--suggest-fixes`",
    );
  });

  test("quick-fix is ignored in quick mode", () => {
    expect(skillMd).toContain("`--quick-fix` with `--quick`");
  });

  test("quick-fix eligibility criteria are documented", () => {
    expect(skillMd).toContain("[HIGH CONFIDENCE]");
    expect(skillMd).toContain("Less than 10 lines changed");
    expect(skillMd).toContain("Single file change");
  });

  test("has CI/JSON mode documentation", () => {
    expect(skillMd).toContain("--ci");
    expect(skillMd).toContain("--json");
    expect(skillMd).toContain("--fail-on");
    expect(skillMd).toContain("--fail-on-regression");
    expect(skillMd).toContain("--fail-on-new");
    expect(skillMd).toContain("--min-severity");
    expect(skillMd).toContain("### 4.8 Structured output");
    expect(skillMd).toContain("AskUserQuestion is NEVER called");
    expect(skillMd).toContain("cat <<'EOF'");
    expect(skillMd).toContain("ci-output.json");
    expect(skillMd).toContain("--baseline-only");
  });

  test("baseline-only mutual exclusions are documented", () => {
    expect(skillMd).toContain(
      "Cannot use `--baseline-only` with `--fail-on-new`",
    );
    expect(skillMd).toContain(
      "Cannot use `--baseline-only` with `--fail-on-regression`",
    );
  });

  test("has SARIF format documentation", () => {
    expect(skillMd).toContain("--format sarif");
    expect(skillMd).toContain("SARIF 2.1.0");
    expect(skillMd).toContain("sarif-schema-2.1.0");
    expect(skillMd).toContain("%SRCROOT%");
    expect(skillMd).toContain("results.sarif");
  });

  test("has infrastructure scanning documentation", () => {
    expect(skillMd).toContain("--no-infra");
    expect(skillMd).toContain("infra-checklist.md");
    expect(skillMd).toContain("skipping infra patterns");
    expect(skillMd).toContain("Infrastructure files detected");
  });

  test("has --plan-fixes alias flag preserved (v1.9.0 carve-out)", () => {
    // The flag itself stays as a backward-compat alias.
    expect(skillMd).toContain("--plan-fixes");
    expect(skillMd).toContain("--thorough");
    // It's now documented as an alias, not inline logic.
    expect(skillMd).toContain("alias");
    expect(skillMd).toContain("/plan-fixes");
  });

  test("Phase 4.7 dispatches to /plan-fixes sibling skill", () => {
    // The dispatch directive must reference the sibling skill and --from
    expect(skillMd).toMatch(/\/plan-fixes.*--from/s);
    // Existence check for the sibling skill is documented
    expect(skillMd).toContain("~/.claude/skills/plan-fixes");
    // --thorough propagation is explicit
    expect(skillMd).toContain("--thorough");
  });

  test("Phase 4.7 dispatch ordering under --quick-fix defers to Phase 5.5", () => {
    // When --quick-fix is also active, the dispatch must happen after Phase 5.5
    // so /plan-fixes sees the post-application baseline.
    expect(skillMd).toContain("Phase 5.5");
    expect(skillMd).toMatch(/quick_fix_status/);
  });

  test("Phase 5.5 baseline rewrite is documented", () => {
    expect(skillMd).toContain("### 5.5 Rewrite baseline");
    expect(skillMd).toContain("quick_fix_status");
    // Option D requires this to be accurate post-application
    expect(skillMd).toMatch(/atomically|temp file.*rename/i);
  });

  test("alias dispatch failure is documented with recovery command", () => {
    // The user must learn the audit succeeded and get a manual recovery path
    expect(skillMd).toContain("Audit completed successfully");
    expect(skillMd).toContain("Baseline written to");
    expect(skillMd).toMatch(/\/plan-fixes --from/);
  });

  test("Phase 4.6 tip points to standalone /plan-fixes", () => {
    // The rewritten tip teaches the new skill name, not the alias
    expect(skillMd).toContain("substantive findings");
    expect(skillMd).toContain("/plan-fixes");
    expect(skillMd).toContain("no re-audit needed");
  });

  test("SARIF discoverability tip fires after alias dispatch", () => {
    expect(skillMd).toContain("SARIF 2.1.0");
    expect(skillMd).toMatch(/--from results\.sarif/);
  });

  test("--plan-fixes edge cases are documented for alias behavior", () => {
    expect(skillMd).toContain("`--plan-fixes` with `--ci`");
    expect(skillMd).toContain("`--plan-fixes` with `--quick`");
    expect(skillMd).toContain("`--plan-fixes --thorough`");
    expect(skillMd).toContain("`--plan-fixes --quick-fix`");
    expect(skillMd).toContain("`--plan-fixes` when `/plan-fixes` sibling skill is not installed");
    expect(skillMd).toContain("`--thorough` without `--plan-fixes`");
  });

  test("Key Rule 7 reverted to three AskUserQuestion locations in codebase-audit", () => {
    // v1.9.0 moved depth consent and plan menu to /plan-fixes, so codebase-audit's
    // own AskUserQuestion surface is back to the pre-v1.8.0 three locations.
    expect(skillMd).toContain("AskUserQuestion fires in three places");
    // Explicitly note the moved locations
    expect(skillMd).toMatch(/depth consent.*plan menu.*\/plan-fixes/s);
  });

  test("Key Rule 2 enforces output discipline (grep mode, dump traps, targeted reads, probe exit-0)", () => {
    // Key Rule 2 was promoted from position 14 in v1.9.0 to make output discipline
    // prominent during Phase 3 checklist execution. Four sub-rules (2a-2d) cover
    // grep content-mode ban, bash dump traps, targeted Read ranges, and probe
    // commands that must exit 0 so parallel tool batches don't cascade-cancel.
    expect(skillMd).toContain("**2a.");
    expect(skillMd).toContain("**2b.");
    expect(skillMd).toContain("**2c.");
    expect(skillMd).toContain("**2d.");
    // 2a: grep content mode ban with the "Found N lines" vs "Found N files" tell —
    // this is the crucial signal that reveals which mode the caller is actually in.
    expect(skillMd).toContain("files_with_matches");
    expect(skillMd).toContain('"Found N lines"');
    expect(skillMd).toContain('"Found N files"');
    // 2b: concrete dump traps named with counter-forms
    expect(skillMd).toContain("pip-audit");
    expect(skillMd).toContain("wc -l");
    // 2c: targeted reads rule of thumb
    expect(skillMd).toMatch(/~30 lines/);
    // 2d: probe commands exit 0, cascade-cancel hazard named, canonical script invocation
    expect(skillMd).toContain("cascade-cancel");
    // v1.9.1: Rule 2d now references lib/probe-exists.sh as the canonical probe form.
    // The inline for-loop from v1.9.0 was insufficient because the LLM paraphrased it
    // back into `ls`. Naming a script that must be invoked verbatim is strictly more
    // transmission-reliable.
    expect(skillMd).toContain("lib/probe-exists.sh");
    // v1.9.2: invocation uses $LIB_DIR (skill install dir), not $REPO_ROOT
    // (audit target's git root). See Key Rule 2d + preamble comment block.
    expect(skillMd).toMatch(/bash\s+["']?\$\{?LIB_DIR\}?\/probe-exists\.sh/);
  });

  test("Preamble references both shared helper scripts (slug.sh + probe-exists.sh)", () => {
    // Both scripts must be named in the preamble comment block so the LLM sees
    // them on every phase entry. See v1.9.1 plan Issue 2 Option D placement.
    const preamble = skillMd.match(/## Preamble[\s\S]*?(?=\n## )/)?.[0] ?? "";
    expect(preamble.length).toBeGreaterThan(100);
    expect(preamble).toContain("lib/slug.sh");
    expect(preamble).toContain("lib/probe-exists.sh");
  });

  test("Preamble defines LIB_DIR with CODEBASE_AUDIT_LIB_DIR env var fallback (v1.9.2)", () => {
    // v1.9.2 fixed a shared-script lookup bug: v1.9.0 and v1.9.1 invoked
    // lib/*.sh via $REPO_ROOT (the audit target's git root) instead of the
    // skill's install directory, so both scripts silently failed to load
    // for any audit target that wasn't codebase-audit itself. The fix
    // introduces $LIB_DIR in the preamble, defaulted to the standard
    // ./setup install path and overridable via CODEBASE_AUDIT_LIB_DIR.
    const preamble = skillMd.match(/## Preamble[\s\S]*?(?=\n## )/)?.[0] ?? "";
    expect(preamble).toContain("LIB_DIR=");
    expect(preamble).toContain("CODEBASE_AUDIT_LIB_DIR");
    expect(preamble).toContain("$HOME/.claude/skills/codebase-audit/lib");
  });

  test("Preamble has stale-symlink warning for missing LIB_DIR (v1.9.2)", () => {
    // Cheap stderr warning at the start of the preamble so users with
    // broken symlinks get a diagnosable first-line message instead of
    // mysterious downstream Phase 1.2 failures. This matters because
    // the new "fail loudly on probe-exists.sh" design removes the LLM's
    // defensive fallback — if LIB_DIR is wrong, Phase 1.2 breaks visibly.
    const preamble = skillMd.match(/## Preamble[\s\S]*?(?=\n## )/)?.[0] ?? "";
    expect(preamble).toMatch(/\[ -d "\$LIB_DIR" \]/);
    expect(preamble).toContain("WARNING:");
    expect(preamble).toContain("does not exist");
  });

  test("Phase 1.2 leads with lib/probe-exists.sh invocation (v1.9.1 transmission fix)", () => {
    // Slice-scoped to Phase 1.2 only. Regression guard for the cascade-cancel bug:
    // Phase 1.2 must not contain `ls -la` anywhere (it's the probe phase, not a
    // directory-listing phase), and it must contain the literal lib/probe-exists.sh
    // invocation. Using section-slice scoping so legitimate `ls -la` in other
    // phases (if ever added) doesn't trip this guard.
    const phase12 = skillMd.match(/### 1\.2 [\s\S]*?(?=\n### )/)?.[0] ?? "";
    expect(phase12.length).toBeGreaterThan(200);

    // Positive signal: canonical script invocation present
    expect(phase12).toContain("lib/probe-exists.sh");
    // v1.9.2: invocation uses $LIB_DIR (the skill's install directory),
    // NOT $REPO_ROOT (the audit target). This is the test that would have
    // failed earlier if any of v1.9.0/v1.9.1's self-hosted testing had
    // bothered to assert the actual invocation syntax — but the v1.9.1
    // assertion used $REPO_ROOT because that's what the buggy SKILL.md
    // had. The v1.9.2 fix + this assertion together close the loop.
    expect(phase12).toMatch(/bash\s+["']?\$\{?LIB_DIR\}?\/probe-exists\.sh/);

    // Negative signal: no `ls -la` regression (this is the v1.9.0 bug the fix addresses)
    expect(phase12).not.toContain("ls -la");
  });

  test("Phase 1.7 dependency check uses jq to filter vulnerabilities", () => {
    // v1.9.0 replaced the raw `--format json` dumps with jq-piped forms so a clean
    // audit emits one line ("No dependency vulnerabilities.") instead of dumping
    // the whole dep list. Covers pip-audit, npm audit, and cargo audit at minimum.
    expect(skillMd).toContain("pip-audit -f json");
    expect(skillMd).toContain("jq");
    expect(skillMd).toContain("No dependency vulnerabilities.");
    // Fallback when jq is unavailable
    expect(skillMd).toMatch(/jq.*not installed|fall back/i);
  });

  test("Phase 4.4 baseline hash uses placeholder + sed pattern (v1.9.1)", () => {
    // v1.9.1 fix for the baseline heredoc quoting bug: the canonical hash
    // pattern is compute-first → single-quoted heredoc with __HASH_N__
    // placeholders → sed substitution → integrity guard. Assertions are
    // slice-scoped to the Phase 4.4 section only so legitimate uses of
    // shasum/heredoc/sed elsewhere in SKILL.md don't trigger false positives.
    const phase44 = skillMd.match(/### 4\.4 [\s\S]*?(?=\n### )/)?.[0] ?? "";
    expect(phase44.length).toBeGreaterThan(500); // sanity check — slice extracted

    // 1. Compute-first helper function pattern — catches regression to
    //    inline $(echo -n ... | shasum) substitution inside a heredoc.
    expect(phase44).toContain("_sha(");
    // Tool fallback: both shasum and sha256sum must be present.
    expect(phase44).toContain("shasum");
    expect(phase44).toContain("sha256sum");

    // 2. Placeholder tokens are the positive signal for the new approach.
    expect(phase44).toContain("__HASH_");

    // 3. Sed substitution pass: both `sed -i.bak` (cross-platform form)
    //    and the `|`-delimited replacement (matches lib/slug.sh convention).
    expect(phase44).toContain("sed -i.bak");
    expect(phase44).toContain("s|__HASH_");

    // 4. Specific bug regression guard: the exact broken form from v1.8.0
    //    (inline command substitution inside a heredoc body) must NOT appear.
    expect(phase44).not.toContain('"id": "$(echo');

    // 5. Integrity guard: the post-sed grep check that catches implementers
    //    who add a finding without a corresponding sed substitution.
    expect(phase44).toContain("grep -q '__HASH_'");
  });

  test("has voice directive", () => {
    expect(skillMd).toContain("## Voice");
  });

  test("has preamble with SLUG via shared contract", () => {
    expect(skillMd).toContain("SLUG=");
    expect(skillMd).toContain("AUDIT_HOME=");
    expect(skillMd).toContain("CODEBASE_AUDIT_HOME");
    // v1.9.0: slug derivation moved to lib/slug.sh shared script
    expect(skillMd).toContain("lib/slug.sh");
  });
});

describe("Supporting files exist", () => {
  test("checklist.md exists and has content", () => {
    const content = fs.readFileSync(path.join(ROOT, "checklist.md"), "utf-8");
    expect(content.length).toBeGreaterThan(50);
  });

  test("report-template.md exists and has content", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "report-template.md"),
      "utf-8",
    );
    expect(content.length).toBeGreaterThan(50);
  });

  test("references/patterns.md exists and has content", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "references", "patterns.md"),
      "utf-8",
    );
    expect(content.length).toBeGreaterThan(50);
  });
});

describe("File references in SKILL.md resolve", () => {
  const skillMd = fs.readFileSync(path.join(ROOT, "SKILL.md"), "utf-8");

  test("checklist path references ~/.claude/skills/codebase-audit/checklist.md", () => {
    expect(skillMd).toContain(
      "~/.claude/skills/codebase-audit/checklist.md",
    );
  });

  test("patterns path references ~/.claude/skills/codebase-audit/references/patterns.md", () => {
    expect(skillMd).toContain(
      "~/.claude/skills/codebase-audit/references/patterns.md",
    );
  });

  test("report template path references ~/.claude/skills/codebase-audit/report-template.md", () => {
    expect(skillMd).toContain(
      "~/.claude/skills/codebase-audit/report-template.md",
    );
  });
});

describe("No external dependencies", () => {
  test("zero references to parent project in entire repo", () => {
    // Read all markdown, typescript, and json files and check for references
    const files = [
      "SKILL.md",
      "checklist.md",
      "report-template.md",
      "references/patterns.md",
      "README.md",
      "CHANGELOG.md",
      "package.json",
    ];
    for (const file of files) {
      const filePath = path.join(ROOT, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        // Check for gstack references (the parent project)
        const matches = content.match(/gstack/gi);
        expect(matches).toBeNull();
      }
    }
  });
});

describe("Metadata files", () => {
  test("VERSION exists and matches semver", () => {
    const version = fs
      .readFileSync(path.join(ROOT, "VERSION"), "utf-8")
      .trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("LICENSE exists", () => {
    expect(fs.existsSync(path.join(ROOT, "LICENSE"))).toBe(true);
  });

  test("CHANGELOG.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "CHANGELOG.md"))).toBe(true);
  });

  test("README.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "README.md"))).toBe(true);
  });

  test("CLAUDE.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "CLAUDE.md"))).toBe(true);
  });

  test("ROADMAP.md exists", () => {
    expect(fs.existsSync(path.join(ROOT, "ROADMAP.md"))).toBe(true);
  });

  test("setup script exists and is executable", () => {
    const setupPath = path.join(ROOT, "setup");
    expect(fs.existsSync(setupPath)).toBe(true);
    const stats = fs.statSync(setupPath);
    expect(stats.mode & 0o111).toBeGreaterThan(0);
  });
});

describe("Package.json scripts", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"),
  );

  test("test script runs all tests, not a single file", () => {
    expect(pkg.scripts.test).toBe("bun test");
  });

  test("test:evals script exists for gated e2e tests", () => {
    expect(pkg.scripts["test:evals"]).toContain("EVALS=1");
    expect(pkg.scripts["test:evals"]).toContain("e2e.test.ts");
  });

  test("no test:all script (redundant with widened test script)", () => {
    expect(pkg.scripts["test:all"]).toBeUndefined();
  });
});

describe("No empty scaffolding directories", () => {
  test("test/fixtures does not exist", () => {
    expect(fs.existsSync(path.join(ROOT, "test", "fixtures"))).toBe(false);
  });

  test("test/helpers does not exist", () => {
    expect(fs.existsSync(path.join(ROOT, "test", "helpers"))).toBe(false);
  });
});
