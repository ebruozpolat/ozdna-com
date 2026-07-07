#!/usr/bin/env bash
# ozDNA production deploy — run after: npx netlify login
set -euo pipefail
cd "$(dirname "$0")/.."
SITE_ID="${SITE_ID:-4ad9a01a-5569-4248-b4c4-970e9226b230}"

echo "→ Building TR pages + SEO..."
node scripts/build-tr-site.mjs
node scripts/apply-seo.mjs

echo "→ Deploying ozdna-614 (site ${SITE_ID})..."
npx netlify deploy --prod --dir=. --site="${SITE_ID}"

echo ""
if [[ "$SITE_ID" == "4ad9a01a-5569-4248-b4c4-970e9226b230" ]]; then
  echo "✓ Live: https://ozdna-614.netlify.app"
  echo "  Custom domain: run ./scripts/connect-domain.sh after releasing ozdna.com from the old Netlify account"
else
  echo "✓ Deployed to site ${SITE_ID}"
fi
echo "  EN: /  ·  TR: /tr/  ·  Docs: /docs/ · /docs/tr/"
echo ""
echo "Next (0 TL launch):"
echo "  1. Plausible → add site ozdna.com (analytics.js already wired)"
echo "  2. GA4 → set GA4_MEASUREMENT_ID in analytics.js → redeploy"
echo "  3. GSC → paste meta tag in index.html → redeploy → submit sitemap.xml"
echo "  4. TezMakale → paste integrations/tezmakale-crosslink.html into footer"
echo "  5. Post 2 LinkedIn updates (copy in LAUNCH-0TL.md)"
