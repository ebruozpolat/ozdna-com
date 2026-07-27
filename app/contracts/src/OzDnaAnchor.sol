// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OzDNA batch anchor — emits Merkle roots of registry batches. Holds no funds, ever.
/// @notice Verbatim from plan/03-ALGORITHMS.md §3.5. No funds, no upgradability; one SSTORE
///         for the counter so batch ids are chain-sequenced. The single mutable slot
///         (`operator`) exists only so the offline `rotator` can swap a leaked hot key.
contract OzDnaAnchor {
    event Anchored(uint256 indexed batchId, bytes32 merkleRoot, uint64 leafCount);
    event OperatorRotated(address indexed newOperator);

    address public immutable rotator; // cold key, offline (§5.2) — can ONLY rotate the operator
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
