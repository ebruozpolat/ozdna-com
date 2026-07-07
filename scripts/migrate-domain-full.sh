#!/usr/bin/env bash
# Full ozdna.com cutover: release on OLD account CLI session → connect on ebru0zpolat.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NETLIFY="$ROOT/scripts/netlify.sh"

echo "=== Step 1/3: Release ozdna.com (must be logged into OLD Netlify account) ==="
"$NETLIFY" status | rg 'Email|Teams' || true
echo ""
read -r -p "Is this the account that originally owned ozdna.com? [y/N] " ok
if [[ "${ok,,}" != "y" ]]; then
  echo "Run: ./scripts/netlify.sh logout && ./scripts/netlify.sh login"
  echo "Then re-run: ./scripts/migrate-domain-full.sh"
  exit 1
fi

./scripts/release-domain-old-account.sh

echo ""
echo "=== Step 2/3: Switch to ebru0zpolat (ozdna-614) ==="
echo "If you have multiple Netlify users, run: ./scripts/netlify.sh switch"
read -r -p "Press Enter after active account is ebru.ozpolat@icloud.com / ebru0zpolat…"

echo ""
echo "=== Step 3/3: Attach domain to ozdna-614 ==="
./scripts/connect-domain.sh

echo ""
echo "Done. Update Namecheap DNS if connect-domain still shows old content."
echo "Smoke test: curl -sI https://ozdna.com/docs/ | head"
