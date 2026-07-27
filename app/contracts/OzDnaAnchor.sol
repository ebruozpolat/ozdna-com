// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OzDNA batch anchor — emits Merkle roots of registry batches. Holds no funds, ever.
/// @dev Normative source: plan/03-ALGORITHMS.md §3.5 (verbatim). solc 0.8.35 line (plan/09).
///      forge tests deferred until Foundry is available in CI (ledger C6).
contract OzDnaAnchor {
    event Anchored(uint256 indexed batchId, bytes32 merkleRoot, uint64 leafCount);
    event OperatorRotated(address indexed newOperator);

    address public immutable rotator; // cold key, offline — can ONLY rotate the operator
    address public operator; // hot gas-wallet key — can ONLY anchor
    uint256 public nextBatchId;

    constructor(address firstOperator) {
        rotator = msg.sender;
        operator = firstOperator;
    }

    function setOperator(address newOperator) external {
        require(msg.sender == rotator, "not rotator");
        operator = newOperator;
        emit OperatorRotated(newOperator);
    }

    function anchor(bytes32 merkleRoot, uint64 leafCount) external {
        require(msg.sender == operator, "not operator");
        emit Anchored(nextBatchId++, merkleRoot, leafCount);
    }
}
