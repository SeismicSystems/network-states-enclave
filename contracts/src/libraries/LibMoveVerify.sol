// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {Config} from "codegen/index.sol";
import {Groth16Proof} from "common/Groth16Proof.sol";
import {IMoveVerifier} from "common/IMoveVerifier.sol";
import {MoveInputs} from "common/MoveInputs.sol";

library LibMoveVerify {
    function verifyMoveProof(
        MoveInputs memory moveInputs,
        Groth16Proof memory moveProof
    ) internal view {
        IMoveVerifier moveVerifierContract = IMoveVerifier(Config.getMoveVerifierContract());
        require(
            moveVerifierContract.verifyProof(
                moveProof.a,
                moveProof.b,
                moveProof.c,
                _moveInputsToArray(moveInputs)
            ),
            "Invalid move proof"
        );
    }

    function _moveInputsToArray(
        MoveInputs memory moveInputs
    ) internal pure returns (uint256[16] memory) {
        return [
            moveInputs.currentInterval,
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
