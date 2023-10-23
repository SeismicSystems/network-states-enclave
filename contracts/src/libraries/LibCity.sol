// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {CityPlayer, CityPlayerTableId} from "codegen/index.sol";

import {getKeysWithValue} from "@latticexyz/world-modules/src/modules/keyswithvalue/getKeysWithValue.sol";
import {PackedCounter} from "@latticexyz/store/src/PackedCounter.sol";

library LibCity {
    function getCities(address player) internal view returns (uint24[] memory) {
        (
            bytes memory staticData,
            PackedCounter encodedLengths,
            bytes memory dynamicData
        ) = CityPlayer.encode({value: player});
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
}
