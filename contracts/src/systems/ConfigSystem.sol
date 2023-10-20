// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {System} from "@latticexyz/world/src/System.sol";

import {Config} from "codegen/index.sol";

contract ConfigSystem is System {
    function setMoveVerifier(address moveVerifier) public {
        Config.setVerifierContract({verifierContract: moveVerifier});
    }

    function setNumStartingTroops(uint32 numStartingTroops) public {
        Config.setNumStartingTroops({numStartingTroops: numStartingTroops});
    }

    function setEnclave(address enclave) public {
        Config.setEnclave({enclave: enclave});
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
