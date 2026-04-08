#!/usr/bin/env bash
#
# Probe for sentinel file existence, printing only files that exist.
#
# This script is a load-bearing contract shared with /codebase-audit and
# /plan-fixes (via SKILL.md Key Rule 2d). Its job is to let phases probe
# for the existence of one or more files without cascade-cancelling sibling
# parallel tool calls in Claude Code.
#
# The trap it closes: `ls -la foo bar baz 2>/dev/null` still exits 1 when
# any of foo/bar/baz is missing, even with stderr suppressed. Claude Code
# batches Bash calls in parallel and treats a non-zero exit in the batch as
# an error, cascade-cancelling the other tools in the batch. The user sees
# red "Cancelled" messages for work that had nothing wrong with it.
#
# This script ALWAYS exits 0, regardless of how many files exist. It prints
# only the files that DO exist, one per line, in the order they were given.
# Sibling parallel tool calls in the same batch are never cancelled.
#
# DO NOT modify without updating both /codebase-audit/SKILL.md and
# /plan-fixes/SKILL.md (if it ever grows a probe phase). The preamble
# comment block in each SKILL.md references this script by path; changes
# here must be tested with test/probe-exists-contract.test.ts.
#
# Usage:
#   bash "$REPO_ROOT/lib/probe-exists.sh" pyproject.toml Makefile Dockerfile
#
# Output (one per line, only existing paths):
#   pyproject.toml
#   Makefile
#   (Dockerfile omitted because it doesn't exist)
#
# Exit code: always 0.
#
# Examples:
#   bash lib/probe-exists.sh file1 file2                    # happy path
#   bash lib/probe-exists.sh /nonexistent/a /nonexistent/b  # no stdout, still exits 0
#   bash lib/probe-exists.sh                                 # zero args, no stdout, exits 0

set -euo pipefail

for f in "$@"; do
  [ -e "$f" ] && echo "$f"
done

# Explicit exit 0 even though set -e + the && short-circuit wouldn't trip
# because `echo` always succeeds and `[ -e ]` failure is swallowed by &&.
# This line is defensive — it guarantees exit 0 regardless of future edits
# that might add additional logic to the loop body.
exit 0
