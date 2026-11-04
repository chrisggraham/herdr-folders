#!/usr/bin/env bash
# Import Herdr's spaces mod at a tag into the herdr-spaces branch.
# Usage: scripts/pull-herdr.sh v0.1.14
set -euo pipefail

tag="${1:?usage: pull-herdr.sh <tag>}"
base="https://raw.githubusercontent.com/herdrdev/herdr-app/$tag"

cd "$(git rev-parse --show-toplevel)"
[ -z "$(git status --porcelain)" ] || { echo "Working tree is dirty; commit or stash first." >&2; exit 1; }
original=$(git branch --show-current)
[ -n "$original" ] || { echo "Detached HEAD; check out a branch first." >&2; exit 1; }

# Download everything first, so a failed fetch leaves nothing half-written.
tmp=$(mktemp -d)
# On any exit, delete the downloads and return to the starting branch.
trap 'rm -rf "$tmp"; git checkout --quiet "$original"' EXIT
curl -fsSL "$base/defaults/mods/spaces/main.js" -o "$tmp/main.js"
curl -fsSL "$base/defaults/mods/spaces/mod.json" -o "$tmp/mod.json"
curl -fsSL "$base/LICENSE" -o "$tmp/LICENSE"

git checkout herdr-spaces
cp "$tmp/main.js" mods/herdr-folders/main.js
cp "$tmp/mod.json" mods/herdr-folders/mod.json
cp "$tmp/LICENSE" LICENSE-APACHE

if [ -z "$(git status --porcelain)" ]; then
  echo "Nothing changed: herdr-spaces already matches $tag."
else
  git add mods/herdr-folders/main.js mods/herdr-folders/mod.json LICENSE-APACHE
  git commit -m "Import Herdr's spaces mod $tag"
fi

echo "Next: git merge herdr-spaces, then set cloned_from.version in mod.json and the version in main.js's header."
