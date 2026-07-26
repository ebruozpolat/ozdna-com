#!/usr/bin/env bash
# Forbidden-word gate for the ozDNA (AlignX oversight) site.
# Acceptance criterion from docs/alignx/website-spec.md: no page may contain
# BrainStack, Solana, blockchain, on-chain, humanizer, or ozDNA spelling variants,
# and no absolute compliance promise ("guarantee/ensure compliance").
# Usage: scripts/check-forbidden.sh   (run from docs/alignx/site/)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILES=$(find "$ROOT" -name '*.html')
FAIL=0

# case-insensitive banned terms
BANNED_I='BrainStack|Solana|blockchain|on-?chain|humanizer'
# spelling variants that must NOT appear (the only allowed form is "ozDNA")
BANNED_SPELLING='OZDNA|OzDNA|ÖZDNA|özdna|Özdna'
# absolute compliance promises
BANNED_CLAIM='guarantee[s]? compliance|ensure[s]? compliance|guaranteed compliant'

check () {
  local label="$1" pattern="$2" flags="$3"
  local hits
  if hits=$(grep -RnE $flags "$pattern" $FILES 2>/dev/null); then
    echo "FAIL [$label]:"
    echo "$hits"
    FAIL=1
  else
    echo "ok   [$label]"
  fi
}

check "banned terms"     "$BANNED_I"        "-i"
check "spelling variants" "$BANNED_SPELLING" ""
check "absolute claims"  "$BANNED_CLAIM"    "-i"

if [ "$FAIL" -ne 0 ]; then
  echo; echo "FORBIDDEN-WORD GATE FAILED"; exit 1
fi
echo; echo "forbidden-word gate passed"
