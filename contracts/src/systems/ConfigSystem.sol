// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {System} from "@latticexyz/world/src/System.sol";

import {Config} from "codegen/index.sol";

contract ConfigSystem is System {
    function setMoveVerifier(address moveVerifier) public {
        Config.setVerifierContract({verifierContract: moveVerifier});
    }
}
