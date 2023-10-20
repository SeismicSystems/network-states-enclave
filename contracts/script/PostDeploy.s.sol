// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "../src/codegen/world/IWorld.sol";
import {Groth16Verifier} from "../src/MoveVerifier.sol";

contract PostDeploy is Script {
    function run(address worldAddress) external {
        // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Start broadcasting transactions from the deployer account
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the Move Verifier contract
        Groth16Verifier moveVerifier = new Groth16Verifier();
        IWorld(worldAddress).setMoveVerifier(address(moveVerifier));

        vm.stopBroadcast();
    }
}
