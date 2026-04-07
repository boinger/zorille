#!/usr/bin/env bash
#
# Canonical repo slug for /codebase-audit and /plan-fixes.
#
# This is a load-bearing contract between the two skills: both must compute
# the same slug for the same repo so that /plan-fixes's auto-discovery can
# find the baseline that /codebase-audit just wrote. Changing the derivation
# here breaks that contract.
#
# DO NOT modify without updating both SKILL.md files AND running
# test/slug-contract.test.ts to verify the fixture URLs still produce
# expected outputs.
#
# Output: a single line on stdout containing the computed slug.
#
# Derivation:
#   1. If `git remote get-url origin` succeeds, extract the last two path
#      segments (owner/repo), strip any `.git` suffix, replace `/` with `-`.
#   2. Otherwise, fall back to the basename of the repo root (or cwd).
#
# Examples:
#   git@github.com:org/repo.git            -> org-repo
#   https://github.com/org/repo.git        -> org-repo
#   https://github.com/org/repo            -> org-repo
#   (no remote)                            -> <basename of repo root>

set -euo pipefail

REMOTE=$(git remote get-url origin 2>/dev/null || true)

if [ -n "$REMOTE" ]; then
  echo "$REMOTE" | sed -E 's|^.*[:/]([^/]+/[^/]+)$|\1|; s|\.git$||; s|/|-|g'
else
  basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
