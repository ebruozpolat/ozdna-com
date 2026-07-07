#!/usr/bin/env bash
# Attach ozdna.com + www to ozdna-614 and verify cutover.
# Prerequisite: domain must be removed from the old Netlify site first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SITE_ID="4ad9a01a-5569-4248-b4c4-970e9226b230"
DOMAIN="ozdna.com"
WWW="www.ozdna.com"
OLD_SITE_ID="d045201d-5c2f-4965-8b28-792dd8325920"

NETLIFY="$ROOT/scripts/netlify.sh"

token() {
  python3 -c "import json; d=json.load(open('$ROOT/.netlify-home/Library/Preferences/netlify/config.json')); print(list(d['users'].values())[0]['auth']['token'])"
}

if ! "$NETLIFY" status >/dev/null 2>&1; then
  echo "→ Netlify login required"
  "$NETLIFY" login
fi

TOKEN=$(token)

api() {
  curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"
}

echo "→ Attaching ${DOMAIN} to ozdna-614 (${SITE_ID})..."
RESP=$(api -X PATCH "https://api.netlify.com/api/v1/sites/${SITE_ID}" \
  -d "{\"custom_domain\":\"${DOMAIN}\",\"domain_aliases\":[\"${WWW}\"]}")

if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('custom_domain')==('$DOMAIN') else 1)" 2>/dev/null; then
  echo "✓ Domain attached"
else
  echo "✗ Could not attach domain:"
  echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
  echo ""
  echo "Blocker: ${DOMAIN} is registered on another Netlify site (${OLD_SITE_ID})."
  echo ""
  echo "Fix (pick one):"
  echo "  A) Log in to the OLD Netlify account → Domain management → remove ${DOMAIN} and ${WWW}"
  echo "     Then re-run: ./scripts/connect-domain.sh"
  echo ""
  echo "  B) If you control that account, deploy here instead:"
  echo "     SITE_ID=${OLD_SITE_ID} ./scripts/deploy-prod.sh"
  echo ""
  echo "  C) Lost access? Namecheap → verify ownership → Netlify Support:"
  echo "     https://www.netlify.com/support/ (request domain release from orphaned site)"
  exit 1
fi

echo "→ Provisioning TLS certificate..."
api -X POST "https://api.netlify.com/api/v1/sites/${SITE_ID}/ssl" -d '{}' >/dev/null || true

echo "→ DNS (Netlify-managed zone recommended):"
echo "   1. Netlify UI → ozdna-614 → Domain management → verify DNS instructions"
echo "   2. Namecheap → Domain → Nameservers → Netlify DNS (dns1.p0X.nsone.net …)"
echo "   Or keep Namecheap DNS and set:"
echo "     A     @    → 75.2.60.5"
echo "     CNAME www  → ${SITE_ID/.netlify.app/}-alias.netlify.app  (see Netlify UI for exact target)"
echo ""

echo "→ Waiting for DNS/SSL (up to 60s)..."
for i in $(seq 1 12); do
  if curl -sfI "https://${DOMAIN}/" | rg -q "LLM Gateway|gateway-chat"; then
    echo "✓ https://${DOMAIN}/ serves new site (gateway docs detected)"
    curl -sfI "https://${DOMAIN}/docs/" | head -5
    exit 0
  fi
  sleep 5
done

echo "⚠ Domain attached in Netlify but https://${DOMAIN}/ still serves old content."
echo "  Update DNS at Namecheap (NS currently: dns*.p09.nsone.net → old Netlify account)."
echo "  After DNS propagates, re-check: curl -sI https://${DOMAIN}/docs/ | head"
exit 0
