// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {City, CityPlayer, CityPlayerTableId} from "codegen/index.sol";
import {MoveInputs} from "common/MoveInputs.sol";

import {getKeysWithValue} from "@latticexyz/world-modules/src/modules/keyswithvalue/getKeysWithValue.sol";
import {PackedCounter} from "@latticexyz/store/src/PackedCounter.sol";

library LibCity {
    function getCities(uint256 pkHash) internal view returns (uint24[] memory) {
        (
            bytes memory staticData,
            PackedCounter encodedLengths,
            bytes memory dynamicData
        ) = CityPlayer.encode({value: pkHash});
        bytes32[] memory citiesRaw = getKeysWithValue({
            tableId: CityPlayerTableId,
            staticData: staticData,
            encodedLengths: encodedLengths,
            dynamicData: dynamicData
        });
        uint24[] memory cities = new uint24[](citiesRaw.length);
        for (uint256 i = 0; i < cities.length; i++) {
            uint24 city = uint24(uint256(citiesRaw[i]));
            cities[i] = city;
        }
        return cities;
    }

    function updateCityOwnership(MoveInputs memory mv) internal {
        if (mv.takingCity) {
            CityPlayer.set({id: mv.toCityId, value: mv.fromPkHash});
        }
    }

    function incrementCityTroops(
        uint24 cityId,
        uint32 increment,
        bool isCityCenter
    ) internal {
        City.setTroopCount({
            id: cityId,
            troopCount: City.getTroopCount({id: cityId}) + increment
        });
        if (isCityCenter) {
            City.setCenterTroopCount({
                id: cityId,
                centerTroopCount: City.getCenterTroopCount({id: cityId}) +
                    increment
            });
        }
    }

    function decrementCityTroops(
        uint24 cityId,
        uint32 decrement,
        bool isCityCenter
    ) internal {
        City.setTroopCount({
            id: cityId,
            troopCount: City.getTroopCount({id: cityId}) - decrement
        });
        if (isCityCenter) {
            City.setCenterTroopCount({
                id: cityId,
                centerTroopCount: City.getCenterTroopCount({id: cityId}) -
                    decrement
            });
        }
    }
}
