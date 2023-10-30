// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {Config, ConsumedCommitment} from "codegen/index.sol";
import {MoveInputs} from "common/MoveInputs.sol";
import {VirtualInputs} from "common/VirtualInputs.sol";
import {Groth16Proof} from "common/Groth16Proof.sol";
import {LibVirtualVerify} from "libraries/LibVirtualVerify.sol";

library LibVirtual {
    function checkInputsOntoUnowned(
        MoveInputs memory moveInputs,
        VirtualInputs memory virtualInputs,
        Groth16Proof memory virtualProof
    ) internal view {
        /// @notice Runs various checks for virtual commitment inputs
        require(
            virtualInputs.hRand == getEnclaveRandCommitment(),
            "H(rand) incorrect"
        );
        require(
            !ConsumedCommitment.get(virtualInputs.hVirt),
            "Virt commitment already consumed"
        );
        require(
            moveInputs.hTTo == virtualInputs.hVirt,
            "hTTo != hVirt"
        );
        LibVirtualVerify.verifyVirtualProof(virtualInputs, virtualProof);
    }

    function getEnclaveRandCommitment() public view returns (uint256) {
        return Config.getEnclaveRandCommitment();
    }
}
