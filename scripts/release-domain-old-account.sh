#!/usr/bin/env bash
# Run while logged into the Netlify account that currently owns ozdna.com.
# Removes custom domain from the old site so ozdna-614 can claim it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NETLIFY="$ROOT/scripts/netlify.sh"
OLD_SITE_ID="${OLD_SITE_ID:-d045201d-5c2f-4965-8b28-792dd8325920}"

if ! "$NETLIFY" status >/dev/null 2>&1; then
  echo "→ Netlify login required (use the account that owns ozdna.com):"
  "$NETLIFY" login
fi

echo "→ Current Netlify user:"
"$NETLIFY" status 2>&1 | rg 'Email|Teams|Site Id' || "$NETLIFY" status

TOKEN=$(python3 -c "import json; d=json.load(open('$ROOT/.netlify-home/Library/Preferences/netlify/config.json')); print(list(d['users'].values())[-1]['auth']['token'])")

echo "→ Fetching site ${OLD_SITE_ID}..."
SITE=$(curl -sS -H "Authorization: Bearer $TOKEN" "https://api.netlify.com/api/v1/sites/${OLD_SITE_ID}")
SITE_CODE=$(echo "$SITE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('code','ok'))" 2>/dev/null || echo "ok")

if [[ "$SITE_CODE" == "404" ]]; then
  echo ""
  echo "✗ Site ${OLD_SITE_ID} is NOT visible on this Netlify account."
  echo ""
  echo "  ozdna.com is registered globally to that site ID on a DIFFERENT account"
  echo "  (not ebru.ozpolat@icloud.com / ebru0zpolat)."
  echo ""
  echo "  Try logging in with the account that originally deployed ozdna.com:"
  echo "    ./scripts/netlify.sh logout"
  echo "    ./scripts/netlify.sh login"
  echo "    # use Google/GitHub/email used for the first ozdna.com Netlify site"
  echo ""
  echo "  Or open Netlify Support with Namecheap proof:"
  echo "    https://www.netlify.com/support/"
  echo "    Site ID: ${OLD_SITE_ID} · Domain: ozdna.com · Target: ozdna-614"
  exit 1
fi

NAME=$(echo "$SITE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name','?'))" 2>/dev/null || echo "?")
CUSTOM=$(echo "$SITE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('custom_domain'))" 2>/dev/null || echo "")

if [[ "$CUSTOM" != "ozdna.com" ]]; then
  echo "Site ${NAME} (${OLD_SITE_ID}) custom_domain=${CUSTOM:-none}"
  echo "Searching all sites on THIS account for ozdna.com..."
  SITES=$(curl -sS -H "Authorization: Bearer $TOKEN" "https://api.netlify.com/api/v1/sites?filter=all&per_page=100")
  OLD_SITE_ID=$(echo "$SITES" | python3 -c "
import sys, json
sites = json.load(sys.stdin)
for s in sites:
    if s.get('custom_domain') == 'ozdna.com' or 'ozdna.com' in (s.get('domain_aliases') or []):
        print(s['id'])
        break
" || true)
  if [[ -z "${OLD_SITE_ID:-}" ]]; then
    echo ""
    echo "✗ ozdna.com not on account $( "$NETLIFY" status 2>&1 | rg 'Email:' | head -1 || true )"
    echo "  Global lock: site d045201d-5c2f-4965-8b28-792dd8325920 (another Netlify team)."
    echo "  See DOMAIN.md or run: ./scripts/netlify.sh login  (different account)"
    exit 1
  fi
  echo "Found site id: ${OLD_SITE_ID}"
fi

echo "→ Removing ozdna.com from site ${OLD_SITE_ID}..."
RESP=$(curl -sS -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "https://api.netlify.com/api/v1/sites/${OLD_SITE_ID}" \
  -d '{"custom_domain":null,"domain_aliases":[]}')

if echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if not d.get('custom_domain') else 1)" 2>/dev/null; then
  echo "✓ Domain released from old site"
else
  echo "✗ Release failed:"
  echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
  exit 1
fi

DOMAIN="${DOMAIN:-ozdna.com}"
echo "→ Removing Netlify DNS zone for ${DOMAIN} (required for cross-account attach)..."
ZONE_ID=$(curl -sS -H "Authorization: Bearer $TOKEN" "https://api.netlify.com/api/v1/dns_zones" | python3 -c "
import sys, json
for z in json.load(sys.stdin):
    if z.get('name') == '${DOMAIN}':
        print(z['id'])
        break
" || true)
if [[ -n "${ZONE_ID:-}" ]]; then
  CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE -H "Authorization: Bearer $TOKEN" \
    "https://api.netlify.com/api/v1/dns_zones/${ZONE_ID}")
  if [[ "$CODE" == "204" ]]; then
    echo "✓ DNS zone deleted"
  else
    echo "⚠ DNS zone delete returned HTTP ${CODE} — remove manually: Team → Domains → ${DOMAIN}"
  fi
else
  echo "  (no DNS zone on this account)"
fi

echo ""
echo "Next (switch back to ebru0zpolat if needed, then):"
echo "  ./scripts/connect-domain.sh"
