// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {System} from "@latticexyz/world/src/System.sol";

import {IEnclaveEvents} from "common/IEnclaveEvents.sol";
import {Config, City, CityPlayer, Founded, PlayerLastUpdateBlock, TileCommitment} from "codegen/index.sol";

contract SpawnSystem is IEnclaveEvents, System {
    function spawn(uint256 pkHash, uint24 cityId, uint256 h) public {
        require(_msgSender() == Config.getEnclave(), "Only enclave can spawn");
        require(cityId != 0, "City ID must be a non-zero value");
        require(CityPlayer.get({id: cityId}) == 0, "City is already in game");

        TileCommitment.set({id: h, value: true});

        CityPlayer.set({id: cityId, value: pkHash});

        City.setArea({id: cityId, area: 1});
        uint32 numStartingTroops = Config.getNumStartingTroops();
        City.setTroopCount({id: cityId, troopCount: numStartingTroops});

        City.setCenterTroopCount({
            id: cityId,
            centerTroopCount: numStartingTroops
        });
        PlayerLastUpdateBlock.set({pkHash: pkHash, value: block.number});

        Founded.set({pkHash: pkHash, value: block.number});

        emit NewTile(h);
    }

    function set(uint256 h) public {
        require(
            _msgSender() == Config.getEnclave(),
            "Only enclave can set commitments"
        );
        TileCommitment.set({id: h, value: true});
        emit NewTile(h);
    }
}
