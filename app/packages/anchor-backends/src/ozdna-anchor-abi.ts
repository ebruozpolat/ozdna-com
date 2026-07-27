/**
 * Minimal ABI for OzDnaAnchor — matches app/contracts/OzDnaAnchor.sol.
 * Keep in sync with the Solidity source; do not invent extra surface.
 */
export const ozDnaAnchorAbi = [
  {
    type: "constructor",
    inputs: [{ name: "firstOperator", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Anchored",
    inputs: [
      { name: "batchId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "merkleRoot", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "leafCount", type: "uint64", indexed: false, internalType: "uint64" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OperatorRotated",
    inputs: [{ name: "newOperator", type: "address", indexed: true, internalType: "address" }],
    anonymous: false,
  },
  {
    type: "function",
    name: "anchor",
    inputs: [
      { name: "merkleRoot", type: "bytes32", internalType: "bytes32" },
      { name: "leafCount", type: "uint64", internalType: "uint64" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "nextBatchId",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "operator",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rotator",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setOperator",
    inputs: [{ name: "newOperator", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
