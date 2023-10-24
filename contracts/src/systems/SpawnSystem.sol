// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {System} from "@latticexyz/world/src/System.sol";

import {IEnclaveEvents} from "common/IEnclaveEvents.sol";
import {Config, SpawnCommitment, SpawnChallengeHash, TileCommitment} from "codegen/index.sol";
import {Groth16Proof} from "common/Groth16Proof.sol";
import {SpawnInputs} from "common/SpawnInputs.sol";
import {Signature} from "common/Signature.sol";
import {IEnclaveEvents} from "common/IEnclaveEvents.sol";
import {LibSpawn} from "libraries/LibSpawn.sol";
import {LibSpawnVerify} from "libraries/LibSpawnVerify.sol";

contract SpawnSystem is IEnclaveEvents, System {
    function commitToSpawn(uint256 h) public {
        require(
            SpawnCommitment.getValue(_msgSender()) == 0,
            "Already commited to spawn"
        );

        SpawnCommitment.set(_msgSender(), block.number);
        SpawnChallengeHash.set(_msgSender(), h);
    }

    function spawn(
        SpawnInputs memory spawnInputs,
        Groth16Proof memory spawnProof,
        Signature memory sig
    ) public {
        LibSpawn.checkSpawnInputs(_msgSender(), spawnInputs, sig);
        LibSpawnVerify.verifySpawnProof(spawnInputs, spawnProof);

        if (spawnInputs.canSpawn) {
            LibSpawn.spawnPlayer(_msgSender(), spawnInputs);

            emit NewTile(spawnInputs.hSpawnTile);
            emit NewSpawnAttempt(_msgSender(), true);
        } else {
            LibSpawn.resetPlayer(_msgSender());

            emit NewSpawnAttempt(_msgSender(), false);
        }
    }

    function set(uint256 h) public {
        require(
            _msgSender() == Config.getEnclave(),
            "Only enclave can set commitments"
        );
        TileCommitment.set({id: h, value: true});
        emit NewTile(h);
    }

    function getSpawnCommitment(address player) public view returns (uint256) {
        return SpawnCommitment.get(player);
    }

    function getSpawnChallengeHash(
        address player
    ) public view returns (uint256) {
        return SpawnChallengeHash.get(player);
    }

    function getBlockHash(uint256 blockCommited) public view returns (uint256) {
        uint256 snarkFieldSize = Config.getSnarkFieldSize();
        return uint256(blockhash(blockCommited)) % snarkFieldSize;
    }
}
