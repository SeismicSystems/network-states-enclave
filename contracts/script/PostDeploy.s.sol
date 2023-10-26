// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IWorld} from "../src/codegen/world/IWorld.sol";
import {Groth16Verifier as MoveVerifier} from "../src/MoveVerifier.sol";
import {Groth16Verifier as SpawnVerifier} from "../src/SpawnVerifier.sol";

contract PostDeploy is Script {
    function run(address worldAddress) external {
        // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Start broadcasting transactions from the deployer account
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the Spawn Verifier contract
        SpawnVerifier spawnVerifier = new SpawnVerifier();
        IWorld(worldAddress).setSpawnVerifier(address(spawnVerifier));

        // Deploy the Move Verifier contract
        MoveVerifier moveVerifier = new MoveVerifier();
        IWorld(worldAddress).setMoveVerifier(address(moveVerifier));

        // Set env variables
        address enclave = vm.envAddress("DEV_CONTRACT_OWNER");
        uint256 fieldSize = vm.envUint("SNARK_FIELD_SIZE");
        uint256 updateInterval = vm.envUint("UPDATE_INTERVAL");
        uint32 startTroops = uint32(vm.envUint("START_RESOURCES"));
        uint256 claimedMoveLifeSpan = vm.envUint("CLAIMED_MOVE_LIFE_SPAN");
        IWorld(worldAddress).setEnclave(enclave);
        IWorld(worldAddress).setSnarkFieldSize(fieldSize);
        IWorld(worldAddress).setNumBlocksInInterval(updateInterval);
        IWorld(worldAddress).setNumStartingTroops(startTroops);
        IWorld(worldAddress).setClaimedMoveLifeSpan(claimedMoveLifeSpan);

        vm.stopBroadcast();
    }
}
