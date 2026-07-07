#!/usr/bin/env bash
# Netlify CLI wrapper — local devDependency + project-scoped auth config.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export HOME="$ROOT/.netlify-home"
mkdir -p "$HOME/Library/Preferences"
cd "$ROOT"
exec "$ROOT/node_modules/.bin/netlify" "$@"
