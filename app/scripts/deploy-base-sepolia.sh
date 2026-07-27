#!/usr/bin/env bash
# Deploy OzDnaAnchor to Base Sepolia. Requires funded rotator key + Foundry.
# Keys: app/certs/dev/base-sepolia-{rotator,operator}.key (gitignored).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${HOME}/.foundry/bin:${PATH}"
RPC="${BASE_RPC_URL:-https://sepolia.base.org}"
ROT_KEY_FILE="${ROOT}/certs/dev/base-sepolia-rotator.key"
OP_KEY_FILE="${ROOT}/certs/dev/base-sepolia-operator.key"

if [[ ! -f "$ROT_KEY_FILE" || ! -f "$OP_KEY_FILE" ]]; then
  echo "Missing keys under certs/dev/. Generate with: cast wallet new (save privately)." >&2
  exit 1
fi

ROT_KEY="$(tr -d ' \n' < "$ROT_KEY_FILE")"
OP_KEY="$(tr -d ' \n' < "$OP_KEY_FILE")"
ROT_ADDR="$(cast wallet address --private-key "$ROT_KEY")"
OP_ADDR="$(cast wallet address --private-key "$OP_KEY")"
BAL="$(cast balance "$ROT_ADDR" --rpc-url "$RPC")"

echo "rotator=$ROT_ADDR"
echo "operator=$OP_ADDR"
echo "balance_wei=$BAL"

if [[ "$BAL" == "0" ]]; then
  echo ""
  echo "BLOCKED: rotator has 0 Base Sepolia ETH."
  echo "Fund $ROT_ADDR via https://www.alchemy.com/faucets/base-sepolia or https://portal.cdp.coinbase.com/"
  echo "Then re-run: bash scripts/deploy-base-sepolia.sh"
  exit 2
fi

cd "$ROOT/contracts"
echo "Deploying OzDnaAnchor(firstOperator=$OP_ADDR)…"
OUT="$(forge create OzDnaAnchor.sol:OzDnaAnchor \
  --rpc-url "$RPC" \
  --private-key "$ROT_KEY" \
  --constructor-args "$OP_ADDR" \
  --json)"
ADDR="$(echo "$OUT" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);console.log(j.deployedTo||j.address||'');})")"
if [[ -z "$ADDR" ]]; then
  echo "Deploy failed. Raw:" >&2
  echo "$OUT" >&2
  exit 1
fi

echo "deployed=$ADDR"
echo "$ADDR" > "$ROOT/certs/dev/base-sepolia-contract.addr"
echo ""
echo "Next — set Worker secrets (do NOT commit):"
echo "  cd apps/anchor"
echo "  echo -n '$RPC' | wrangler secret put BASE_RPC_URL"
echo "  wrangler secret put ANCHOR_PRIVATE_KEY   # paste operator private key"
echo "  echo -n '$ADDR' | wrangler secret put ANCHOR_CONTRACT_ADDRESS"
echo "  # then set vars.ANCHOR_BACKEND=base in wrangler.jsonc and redeploy"
