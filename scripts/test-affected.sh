#!/usr/bin/env bash
# Tier-1 local validation: run only the tests Jest relates to files changed vs the
# base ref (default origin/main), including untracked new files. The full suite is
# CI's job (see CLAUDE.md "Testing Protocol" and .github/workflows/ci.yml).
#
# Override the base with: BASE_REF=origin/develop npm run test:affected
set -euo pipefail

BASE_REF="${BASE_REF:-origin/main}"

if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null 2>&1; then
  echo "test:affected: ref '$BASE_REF' not found — fetching origin…" >&2
  git fetch origin main --quiet || true
fi

if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null 2>&1; then
  echo "test:affected: '$BASE_REF' unavailable; falling back to the full suite." >&2
  exec npm test
fi

MERGE_BASE="$(git merge-base HEAD "$BASE_REF")"

# Changed (committed + working tree) and untracked .ts/.tsx files, excluding dist/
# and files that no longer exist. Repo paths contain no spaces.
FILES=""
while IFS= read -r f; do
  [ -f "$f" ] && FILES="$FILES $f"
done < <({ git diff --name-only "$MERGE_BASE"; git ls-files --others --exclude-standard; } \
  | grep -E '\.(ts|tsx)$' | grep -v '^dist/' | sort -u)

if [ -z "$FILES" ]; then
  echo "test:affected: no changed .ts/.tsx files vs $BASE_REF — nothing to run."
  exit 0
fi

echo "test:affected: changed files vs $BASE_REF ($(git log -1 --format=%h "$MERGE_BASE")):"
echo "$FILES" | tr ' ' '\n' | sed '/^$/d' | sed 's/^/  /'
NODE_ENV=test npx jest --findRelatedTests $FILES --passWithNoTests
