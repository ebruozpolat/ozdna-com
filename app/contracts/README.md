# contracts/ — OzDnaAnchor (Foundry)

`OzDnaAnchor.sol` is the Base-mainnet batch-anchor contract, **verbatim from
`plan/03-ALGORITHMS.md` §3.5**: it emits `Anchored(batchId, merkleRoot, leafCount)` for
each registry batch, holds **no funds ever**, has no upgradability, and keeps one mutable
slot (`operator`, the hot gas-wallet key) that only the offline `rotator` key can swap.

## ⚠ NOT compiled/tested in the authoring environment
`forge` (Foundry) was unavailable where this was written, and the network install
(`foundryup`) was blocked, so `OzDnaAnchor.sol` and `test/OzDnaAnchor.t.sol` have **not
been compiled or run**. Treat both as unverified until a `forge test` pass. (Session
deferrals ledger, item 2 / C6.)

## Verify locally
```bash
# install Foundry (once)
curl -L https://foundry.paradigm.xyz | bash && foundryup
# from app/contracts/
forge install foundry-rs/forge-std   # test dependency (creates lib/forge-std)
forge build                          # solc 0.8.35 (foundry.toml)
forge test -vvv                      # runs test/OzDnaAnchor.t.sol
```

The tests assert: constructor sets `rotator`/`operator` and `nextBatchId = 0`; `anchor`
increments the batch id and emits `Anchored` (operator only; reverts `not operator`
otherwise); `setOperator` rotates + emits (rotator only; reverts `not rotator`), and after
rotation the old operator can no longer anchor.

## Deploy (later, founder-provisioned)
Deploy once with the gas wallet as `firstOperator` (Base Sepolia 84532 in dev/staging;
Base mainnet 8453 in prod, ≤ ~$20 of our own ETH — never user funds, hard rule 2). The
deployed address becomes `ANCHOR_CONTRACT_ADDRESS` (public var) read by `apps/anchor` and
the verify page. See `plan/09-DEV-SETUP.md` §5–§6.

## Still not built (ledger C7)
`packages/anchor-backends` — the `AnchorBackend` interface + `NullAdapter` (dev/test, fake
receipts) + `BaseAdapter` (viem). Nothing outside `apps/anchor` may import viem or any
chain SDK (plan/01 §6 invariant).
