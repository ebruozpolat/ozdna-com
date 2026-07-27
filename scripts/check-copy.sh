#!/usr/bin/env bash
# Compatibility alias — older session notes called this check-copy.sh.
# Canonical gate: oversight/scripts/check-forbidden.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/oversight/scripts/check-forbidden.sh"
