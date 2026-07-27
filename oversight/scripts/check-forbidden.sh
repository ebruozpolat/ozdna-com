#!/usr/bin/env bash
# Forbidden-word gate for ozDNA HTML surfaces.
# Spec: docs/oversight/website-spec.md (oversight) + session ledger A10 (verify scope).
#
# Scopes:
#   1) oversight/  — full gate (banned terms + ozDNA spelling variants + absolute claims)
#   2) verify/ + tr/verify/ — provenance subset (banned terms + absolute claims).
#      Spelling variants are NOT applied sitewide yet: marketing pages still use stylized
#      "OZDNA.COM" / "BY OZDNA" labels; a full spelling pass is the roadmap-90d Hafta 1 item.
#
# Usage (from repo root or oversight/):
#   bash oversight/scripts/check-forbidden.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OVERSIGHT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$OVERSIGHT_ROOT/.." && pwd)"

FAIL=0

BANNED_I='BrainStack|Solana|blockchain|on-?chain|humanizer'
BANNED_SPELLING='OZDNA|OzDNA|ÖZDNA|özdna|Özdna'
BANNED_CLAIM='guarantee[s]? compliance|ensure[s]? compliance|guaranteed compliant'

# Collect HTML paths into a newline-separated string (macOS bash 3.2–safe; no mapfile).
collect_html () {
  find "$@" -name '*.html' 2>/dev/null | sort || true
}

check_scope () {
  local scope_label="$1" pattern="$2" flags="$3" files="$4"
  if [ -z "$files" ]; then
    echo "ok   [$scope_label] (no files)"
    return
  fi
  local hits
  # shellcheck disable=SC2086
  if hits=$(printf '%s\n' "$files" | tr '\n' '\0' | xargs -0 grep -nE $flags "$pattern" 2>/dev/null); then
    echo "FAIL [$scope_label]:"
    echo "$hits"
    FAIL=1
  else
    echo "ok   [$scope_label]"
  fi
}

OVERSIGHT_HTML="$(collect_html "$OVERSIGHT_ROOT")"
VERIFY_HTML="$(collect_html "$REPO_ROOT/verify" "$REPO_ROOT/tr/verify")"

echo "== oversight (full gate) =="
check_scope "oversight banned terms"      "$BANNED_I"        "-i" "$OVERSIGHT_HTML"
check_scope "oversight spelling variants" "$BANNED_SPELLING" ""   "$OVERSIGHT_HTML"
check_scope "oversight absolute claims"   "$BANNED_CLAIM"    "-i" "$OVERSIGHT_HTML"

echo
echo "== verify pages (provenance subset; spelling deferred to sitewide pass) =="
check_scope "verify banned terms"    "$BANNED_I"     "-i" "$VERIFY_HTML"
check_scope "verify absolute claims" "$BANNED_CLAIM" "-i" "$VERIFY_HTML"

if [ "$FAIL" -ne 0 ]; then
  echo; echo "FORBIDDEN-WORD GATE FAILED"; exit 1
fi
echo; echo "forbidden-word gate passed"
