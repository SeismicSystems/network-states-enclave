// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {Config} from "codegen/index.sol";
import {Groth16Proof} from "common/Groth16Proof.sol";
import {IVirtualVerifier} from "common/IVirtualVerifier.sol";
import {VirtualInputs} from "common/VirtualInputs.sol";

library LibVirtualVerify {
    function verifyVirtualProof(
        VirtualInputs memory virtualInputs,
        Groth16Proof memory virtualProof
    ) internal view {
        IVirtualVerifier virtualVerifierContract = IVirtualVerifier(
            Config.getVirtualVerifierContract()
        );
        require(
            virtualVerifierContract.verifyProof(
                virtualProof.a,
                virtualProof.b,
                virtualProof.c,
                _virtualInputsToArray(virtualInputs)
            ),
            "Invalid virtual proof"
        );
    }

    function _virtualInputsToArray(
        VirtualInputs memory virtualInputs
    ) internal pure returns (uint256[2] memory) {
        return [
            virtualInputs.hRand,
            virtualInputs.hVirt
        ];
    }
}
