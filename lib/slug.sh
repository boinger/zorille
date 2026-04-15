#!/usr/bin/env bash
#
# Canonical repo slug for /codebase-audit, /plan-fixes, /issue-forensics.
#
# This is a load-bearing contract among these skills: they must compute the
# same slug for the same repo so cross-skill auto-discovery works. Changing
# the derivation here breaks that contract.
#
# DO NOT modify without updating all three SKILL.md files AND running
# test/slug-contract.test.ts to verify the fixture URLs still produce
# expected outputs.
#
# Output: a single line on stdout containing the computed slug.
#
# Invocation:
#   bash slug.sh              — derive from cwd's git remote origin (default)
#   bash slug.sh <url|path>   — derive from explicit URL or filesystem path
#                               (used by /issue-forensics when the target repo
#                               is not cwd, e.g. investigating loki from a
#                               give-back workspace dir)
#
# Derivation:
#   1. If an argument is given and looks like a URL (http[s]://, git@, ssh://),
#      apply URL-to-slug normalization to it.
#   2. If an argument is given and is a filesystem path, use basename.
#   3. Otherwise (no argument), use `git remote get-url origin` from cwd.
#   4. If that fails, fall back to the basename of the repo root (or cwd).
#
# Examples:
#   git@github.com:org/repo.git                    -> org-repo
#   https://github.com/org/repo.git                -> org-repo
#   https://github.com/org/repo                    -> org-repo
#   https://gitlab.example.com/group/sub/repo      -> sub-repo (last two segments)
#   (no remote, no arg)                            -> <basename of repo root>

set -euo pipefail

# URL-to-slug normalization, applied to a URL on stdin.
url_to_slug() {
  sed -E 's|^.*[:/]([^/]+/[^/]+)$|\1|; s|\.git$||; s|/|-|g'
}

# Explicit argument mode: derive slug from the provided URL or path.
if [ "$#" -gt 0 ] && [ -n "${1:-}" ]; then
  INPUT="$1"
  if echo "$INPUT" | grep -qE '^(https?://|git@|ssh://)'; then
    echo "$INPUT" | url_to_slug
  else
    # Assume filesystem path; use basename
    basename "$INPUT"
  fi
  exit 0
fi

# Default mode: derive from cwd's git remote.
REMOTE=$(git remote get-url origin 2>/dev/null || true)

if [ -n "$REMOTE" ]; then
  echo "$REMOTE" | url_to_slug
else
  basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
