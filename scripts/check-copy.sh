#!/usr/bin/env bash
# Repo-wide copy gate — extends the oversight forbidden-word check (oversight/scripts/
# check-forbidden.sh) to the content-provenance VERIFY pages (ledger A10). Scans both
# surfaces for the unambiguous banned terms; for the content-provenance pages it also
# checks rule-5 authenticity overclaims. Run from repo root: scripts/check-copy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

OVERSIGHT=$(find oversight -name '*.html' 2>/dev/null || true)
VERIFY="verify/index.html tr/verify/index.html"
FAIL=0

check () {
  local label="$1" files="$2" pattern="$3" flags="$4"
  local hits
  if hits=$(grep -RInE $flags "$pattern" $files 2>/dev/null); then
    echo "FAIL [$label]:"; echo "$hits"; FAIL=1
  else
    echo "ok   [$label]"
  fi
}

# unambiguous terms — must never appear on EITHER surface
BANNED='BrainStack|Solana|on-?chain|humanizer'
# oversight brand rule: only "ozDNA" allowed, all variants forbidden
SPELL='OZDNA|OzDNA|ÖZDNA|özdna|Özdna'
# content-provenance uses ALL-CAPS "OZDNA" in its wordmark/label styling across the whole
# live site (home/comply/origin), so we catch real typos there but NOT the styled all-caps.
# (Cross-track casing inconsistency — oversight "ozDNA" vs content-provenance "OZDNA"
# wordmark — is a founder brand decision, logged in docs/session-deferrals-2026-07-27.md.)
SPELL_CP='OzDNA|ÖZDNA|özdna|Özdna'
# content-provenance rule 5: never positively claim authenticity (self-signed = "unknown source")
RULE5='\bauthentic\b|\bgenuine\b|verified real|\bcertified\b'

echo "— oversight —"
check "banned terms"      "$OVERSIGHT" "$BANNED" "-i"
check "spelling variants" "$OVERSIGHT" "$SPELL"  ""
echo "— content-provenance verify (A10) —"
check "banned terms"      "$VERIFY" "$BANNED" "-i"
check "spelling typos (all-caps wordmark allowed)" "$VERIFY" "$SPELL_CP" ""
check "rule-5 authenticity overclaim" "$VERIFY" "$RULE5" "-i"
# 'blockchain' stays invisible plumbing on the verify page (BLUEPRINT rule 4)
check "blockchain in copy" "$VERIFY" "blockchain" "-i"

# NOTE (stated, not silent): the "trusted Content Credentials" rule-5 check is NOT automated
# here — the verify page uses that phrase only inside an honest NEGATION ("we don't claim
# 'trusted Content Credentials'"), which a naive grep would false-positive. That specific
# overclaim stays a manual copy-audit item.

if [ "$FAIL" -ne 0 ]; then echo; echo "COPY GATE FAILED"; exit 1; fi
echo; echo "copy gate passed"
