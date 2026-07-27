// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OzDnaAnchor} from "../src/OzDnaAnchor.sol";

// UNVERIFIED IN AUTHORING ENV: `forge` was not available where this was written, so this
// test has NOT been compiled or run. Run `forge install foundry-rs/forge-std` then
// `forge test` to verify. (Ledger item 2 / C6.)
contract OzDnaAnchorTest is Test {
    OzDnaAnchor anchor;
    address rotator = address(this); // deployer becomes the rotator
    address operator = address(0xBEEF);
    address thief = address(0xBAD);

    event Anchored(uint256 indexed batchId, bytes32 merkleRoot, uint64 leafCount);
    event OperatorRotated(address indexed newOperator);

    function setUp() public {
        anchor = new OzDnaAnchor(operator);
    }

    function test_constructor_setsRotatorAndOperator() public view {
        assertEq(anchor.rotator(), rotator);
        assertEq(anchor.operator(), operator);
        assertEq(anchor.nextBatchId(), 0);
    }

    function test_anchor_incrementsBatchId_andEmits() public {
        bytes32 root = keccak256("batch-0");
        vm.expectEmit(true, false, false, true);
        emit Anchored(0, root, 4096);
        vm.prank(operator);
        anchor.anchor(root, 4096);
        assertEq(anchor.nextBatchId(), 1);

        vm.prank(operator);
        anchor.anchor(keccak256("batch-1"), 10);
        assertEq(anchor.nextBatchId(), 2);
    }

    function test_anchor_revertsForNonOperator() public {
        vm.prank(thief);
        vm.expectRevert(bytes("not operator"));
        anchor.anchor(keccak256("x"), 1);
    }

    function test_setOperator_byRotator_rotatesAndEmits() public {
        address next = address(0xF00D);
        vm.expectEmit(true, false, false, false);
        emit OperatorRotated(next);
        anchor.setOperator(next); // msg.sender == rotator (this)
        assertEq(anchor.operator(), next);

        // old operator can no longer anchor; new one can
        vm.prank(operator);
        vm.expectRevert(bytes("not operator"));
        anchor.anchor(keccak256("y"), 1);

        vm.prank(next);
        anchor.anchor(keccak256("z"), 1);
        assertEq(anchor.nextBatchId(), 1);
    }

    function test_setOperator_revertsForNonRotator() public {
        vm.prank(thief);
        vm.expectRevert(bytes("not rotator"));
        anchor.setOperator(thief);
    }
}
