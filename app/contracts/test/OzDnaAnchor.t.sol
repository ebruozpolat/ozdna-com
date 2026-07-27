// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OzDnaAnchor} from "../OzDnaAnchor.sol";

contract OzDnaAnchorTest is Test {
    OzDnaAnchor internal anchor;
    address internal rotator = address(this);
    address internal operator = address(0xB0B);
    address internal stranger = address(0xBAD);

    function setUp() public {
        vm.prank(rotator);
        anchor = new OzDnaAnchor(operator);
    }

    function test_constructor_sets_roles() public view {
        assertEq(anchor.rotator(), rotator);
        assertEq(anchor.operator(), operator);
        assertEq(anchor.nextBatchId(), 0);
    }

    function test_operator_can_anchor() public {
        bytes32 root = keccak256("batch-1");
        vm.prank(operator);
        vm.expectEmit(true, false, false, true);
        emit OzDnaAnchor.Anchored(0, root, 3);
        anchor.anchor(root, 3);
        assertEq(anchor.nextBatchId(), 1);
    }

    function test_stranger_cannot_anchor() public {
        vm.prank(stranger);
        vm.expectRevert("not operator");
        anchor.anchor(bytes32(uint256(1)), 1);
    }

    function test_only_rotator_rotates_operator() public {
        address next = address(0xACE);
        vm.prank(stranger);
        vm.expectRevert("not rotator");
        anchor.setOperator(next);

        vm.prank(rotator);
        anchor.setOperator(next);
        assertEq(anchor.operator(), next);
    }

    function test_contract_has_no_payable_receive() public {
        // Hard rule: never touch user funds. No receive/fallback that accepts ETH.
        (bool ok,) = address(anchor).call{value: 1 ether}("");
        assertFalse(ok);
    }
}
