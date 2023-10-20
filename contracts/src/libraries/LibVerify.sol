// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {Config} from "codegen/index.sol";
import {Groth16Proof} from "common/Groth16Proof.sol";
import {IVerifier} from "common/IVerifier.sol";
import {MoveInputs} from "common/MoveInputs.sol";

library LibVerify {
    function verifyProof(
        MoveInputs memory moveInputs,
        Groth16Proof memory moveProof
    ) internal view {
        IVerifier verifierContract = IVerifier(Config.getVerifierContract());
        require(
            verifierContract.verifyProof(
                moveProof.a,
                moveProof.b,
                moveProof.c,
                _toArray(moveInputs)
            ),
            "Invalid move proof"
        );
    }

    function _toArray(
        MoveInputs memory moveInputs
    ) internal pure returns (uint256[17] memory) {
        return [
            moveInputs.currentInterval,
            moveInputs.fromPkHash,
            moveInputs.fromCityId,
            moveInputs.toCityId,
            moveInputs.ontoSelfOrUnowned ? 1 : 0,
            moveInputs.numTroopsMoved,
            moveInputs.enemyLoss,
            moveInputs.fromIsCityCenter ? 1 : 0,
            moveInputs.toIsCityCenter ? 1 : 0,
            moveInputs.takingCity ? 1 : 0,
            moveInputs.takingCapital ? 1 : 0,
            moveInputs.fromCityTroops,
            moveInputs.toCityTroops,
            moveInputs.hTFrom,
            moveInputs.hTTo,
            moveInputs.hUFrom,
            moveInputs.hUTo
        ];
    }
}
