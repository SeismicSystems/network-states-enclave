// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {System} from "@latticexyz/world/src/System.sol";

import {Config, CityCenterTroopCount, TileCommitment} from "codegen/index.sol";
import {Groth16Proof} from "common/Groth16Proof.sol";
import {MoveInputs} from "common/MoveInputs.sol";
import {Signature} from "common/Signature.sol";
import {IEnclaveEvents} from "common/IEnclaveEvents.sol";
import {LibMove} from "libraries/LibMove.sol";
import {LibMoveVerify} from "libraries/LibMoveVerify.sol";

contract MoveSystem is IEnclaveEvents, System {
    function move(
        MoveInputs memory moveInputs,
        Groth16Proof memory moveProof,
        Signature memory sig
    ) public {
        LibMove.checkMoveInputs(_msgSender(), moveInputs, sig);
        LibMoveVerify.verifyMoveProof(moveInputs, moveProof);

        TileCommitment.deleteRecord({id: moveInputs.hTFrom});
        TileCommitment.set({id: moveInputs.hUFrom, value: true});
        TileCommitment.deleteRecord({id: moveInputs.hTTo});
        TileCommitment.set({id: moveInputs.hUTo, value: true});

        LibMove.updateCityTroopCounts(moveInputs);
        LibMove.updateCityOwnership(_msgSender(), moveInputs);

        // Should be an offchain table since we're in MUD-land, but fine for now
        emit NewMove(moveInputs.hUFrom, moveInputs.hUTo);
        emit NewTile(moveInputs.hUFrom);
        emit NewTile(moveInputs.hUTo);
    }

    function getCurrentInterval() public view returns (uint256) {
        return block.number / Config.getNumBlocksInInterval();
    }

    function getCityCenterTroops(uint24 cityId) public view returns (uint32) {
        return CityCenterTroopCount.get({id: cityId});
    }
}
