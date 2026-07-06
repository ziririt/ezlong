#!/usr/bin/env bash
#
# Safe git push helper for ezlong.com.
# It never runs git reset --hard and never stages files implicitly with git add -A.
#
# Usage:
#   ./scripts/safe-deploy.sh "commit message" file1 file2 ...

set -euo pipefail

COMMIT_MSG="${1:-}"
shift || true
FILES=("$@")

if [[ -z "$COMMIT_MSG" ]]; then
  echo "Usage: ./scripts/safe-deploy.sh \"commit message\" file1 file2 ..." >&2
  exit 1
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "List the files to commit explicitly. Refusing to run git add -A." >&2
  exit 1
fi

echo "[1/6] git pull --rebase origin main"
git pull --rebase origin main

echo "[2/6] git status --short"
git status --short

echo "[3/6] npm run verify:time"
npm run verify:time

echo "[4/6] git add explicit files"
git add "${FILES[@]}"

echo "[5/6] git commit"
git commit -m "$COMMIT_MSG"

echo "[6/6] git pull --rebase --autostash origin main && git push origin HEAD:main"
git pull --rebase --autostash origin main
git push origin HEAD:main

echo "Done. If manual Firebase deploy is needed:"
echo "  /opt/homebrew/bin/firebase deploy --only hosting --project ezlong-541a8"
