// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {System} from "@latticexyz/world/src/System.sol";

import {Config, City, TileCommitment, ConsumedCommitment} from "codegen/index.sol";
import {Groth16Proof} from "common/Groth16Proof.sol";
import {Move, MoveInputs} from "common/MoveInputs.sol";
import {VirtualInputs} from "common/VirtualInputs.sol";
import {Signature} from "common/Signature.sol";
import {IEnclaveEvents} from "common/IEnclaveEvents.sol";
import {LibCity} from "libraries/LibCity.sol";
import {LibMove} from "libraries/LibMove.sol";
import {LibVirtual} from "libraries/LibVirtual.sol";
import {LibMoveVerify} from "libraries/LibMoveVerify.sol";

contract MoveSystem is IEnclaveEvents, System {
    function move(
        Move memory moveParams,
        Groth16Proof memory moveProof,
        VirtualInputs memory virtualInputs,
        Groth16Proof memory virtualProof,
        Signature memory sig
    ) public {
        
        // Perform lazy updates first
        LibMove.updateCityTroopCountsBeforeMove(moveParams);

        MoveInputs memory moveInputs = LibMove.getMoveInputs(moveParams);

        LibMove.checkMoveInputs(_msgSender(), moveInputs, sig);
        LibMoveVerify.verifyMoveProof(moveInputs, moveProof);

        bool ontoUnowned = moveInputs.toCityId == 0;
        if (ontoUnowned) {
            LibVirtual.checkInputsOntoUnowned(
                moveInputs,
                virtualInputs,
                virtualProof
            );

            // If moving onto unowned tile, consume virtual commitment
            ConsumedCommitment.set(virtualInputs.hVirt, true);
        } else {
            // Must check that hTTo is a valid tile
            require(
                TileCommitment.getValue({id: moveInputs.hTTo}),
                "hTTo does not exist"
            );
        }

        // Execute whether or not player moves onto unowned tile
        TileCommitment.deleteRecord({id: moveInputs.hTFrom});
        TileCommitment.set({id: moveInputs.hUFrom, value: true});
        TileCommitment.deleteRecord({id: moveInputs.hTTo});
        TileCommitment.set({id: moveInputs.hUTo, value: true});

        LibMove.updateCityTroopCountsAfterMove(moveInputs);
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
        return City.getCenterTroopCount({id: cityId});
    }
}
