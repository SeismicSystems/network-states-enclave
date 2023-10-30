// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {System} from "@latticexyz/world/src/System.sol";

import {Config} from "codegen/index.sol";

contract ConfigSystem is System {
    function setVirtualVerifier(address virtualVerifier) public {
        Config.setVirtualVerifierContract({
            virtualVerifierContract: virtualVerifier
        });
    }

    function setSpawnVerifier(address spawnVerifier) public {
        Config.setSpawnVerifierContract({spawnVerifierContract: spawnVerifier});
    }

    function setMoveVerifier(address moveVerifier) public {
        Config.setMoveVerifierContract({moveVerifierContract: moveVerifier});
    }

    function setSnarkFieldSize(uint256 fieldSize) public {
        Config.setSnarkFieldSize({snarkFieldSize: fieldSize});
    }

    function setNumStartingTroops(uint32 numStartingTroops) public {
        Config.setNumStartingTroops({numStartingTroops: numStartingTroops});
    }

    function setEnclave(address enclave) public {
        Config.setEnclave({enclave: enclave});
    }

    function setEnclaveRandCommitment(uint256 randCommitment) public {
        Config.setEnclaveRandCommitment({
            enclaveRandCommitment: randCommitment
        });
    }

    function setClaimedMoveLifeSpan(uint256 claimedMoveLifeSpan) public {
        Config.setClaimedMoveLifeSpan({
            claimedMoveLifeSpan: claimedMoveLifeSpan
        });
    }

    function setNumBlocksInInterval(uint256 numBlocksInInterval) public {
        Config.setNumBlocksInInterval({
            numBlocksInInterval: numBlocksInInterval
        });
    }
}
