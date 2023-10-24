// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {IWorld} from "codegen/world/IWorld.sol";
import {SpawnCommitment} from "codegen/index.sol";
import {LibSpawn} from "libraries/LibSpawn.sol";

import "forge-std/Test.sol";
import {MudTest} from "@latticexyz/world/test/MudTest.t.sol";

contract SpawnTest is MudTest {
    IWorld private world;

    function setUp() public override {
        super.setUp();
        world = IWorld(worldAddress);
    }

    function test_DoubleSpawn() public {
        address player = address(0xface);
        vm.roll(10);
        vm.startPrank(player);
        world.commitToSpawn(123);
        vm.expectRevert();
        world.commitToSpawn(123);
        vm.stopPrank();
    }

    function test_SpawnReset() public {
        address player = address(0xface);
        vm.roll(10);
        vm.prank(player);
        world.commitToSpawn(123);

        console.log(
            "SpawnCommitment before reset",
            SpawnCommitment.getBlockNumber(player)
        );

        assertTrue(SpawnCommitment.getBlockNumber(player) != 0);

        console.log(
            "SpawnCommitment after reset",
            SpawnCommitment.getBlockNumber(player)
        );

        assertEq(SpawnCommitment.getBlockNumber(player), 0);

        vm.prank(player);
        world.commitToSpawn(123);
    }
}
