// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {CityArea, CityTroopCount, CityCenterTroopCount, CityPlayer, PlayerLastUpdateBlock, Config, TileCommitment} from "codegen/index.sol";
import {MoveInputs} from "common/MoveInputs.sol";
import {Signature} from "common/Signature.sol";
import {LibCity} from "libraries/LibCity.sol";

library LibMove {
    /// @notice Runs various checks for the move
    function checkMoveInputs(
        address player,
        MoveInputs memory moveInputs,
        Signature memory sig
    ) internal view {
        require(
            TileCommitment.getValue({id: moveInputs.hTFrom}) &&
                TileCommitment.getValue({id: moveInputs.hTTo}),
            "Old tile states must be valid"
        );
        require(
            block.number <= sig.b + Config.getClaimedMoveLifeSpan(),
            "Move expired"
        );
        require(
            _getCurrentInterval() >= moveInputs.currentInterval,
            "Move too far"
        );
        require(
            _checkOntoSelfOrUnowned({player: player, mv: moveInputs}),
            "Incorrect ontoSelfOrUnowned"
        );
        require(
            _checkCityTroops({mv: moveInputs}),
            "Incorrect (from/to)CityTroops"
        );
        require(
            _getSigner({
                hUFrom: moveInputs.hUFrom,
                hUTo: moveInputs.hUTo,
                sig: sig
            }) == Config.getEnclave(),
            "Incorrect enclave signature"
        );
    }

    function updateCityTroopCounts(MoveInputs memory mv) internal {
        if (
            mv.takingCity ||
            mv.takingCapital ||
            (mv.ontoSelfOrUnowned && mv.toCityId != 0)
        ) {
            // Taking city/capital, or moving onto self-owned tile
            _decrementCityTroops({
                cityId: mv.fromCityId,
                decrement: mv.numTroopsMoved,
                isCityCenter: mv.fromIsCityCenter
            });
        } else if (!mv.ontoSelfOrUnowned) {
            // Capturing enemy non-city tile or attacking enemy
            _decrementCityTroops({
                cityId: mv.fromCityId,
                decrement: mv.enemyLoss,
                isCityCenter: mv.fromIsCityCenter
            });
        } else if (mv.fromIsCityCenter) {
            // Moving onto unowned tile
            CityCenterTroopCount.set({
                id: mv.fromCityId,
                value: CityCenterTroopCount.get({id: mv.fromCityId}) -
                    mv.numTroopsMoved
            });
        }

        if (mv.ontoSelfOrUnowned && mv.toCityId != 0) {
            // Moving onto self-owned tile
            _incrementCityTroops({
                cityId: mv.toCityId,
                increment: mv.numTroopsMoved,
                isCityCenter: mv.toIsCityCenter
            });
        } else if (mv.takingCity || mv.takingCapital) {
            // Taking enemy city/capital
            _incrementCityTroops({
                cityId: mv.toCityId,
                increment: mv.numTroopsMoved - mv.enemyLoss,
                isCityCenter: mv.toIsCityCenter
            });
        } else if (!mv.ontoSelfOrUnowned) {
            // Capturing enemy non-city tile or attacking enemy
            _decrementCityTroops({
                cityId: mv.toCityId,
                decrement: mv.enemyLoss,
                isCityCenter: mv.toIsCityCenter
            });
        }

        if (!mv.ontoSelfOrUnowned && !mv.takingCity && !mv.takingCapital) {
            CityArea.set({
                id: mv.fromCityId,
                value: CityArea.get({id: mv.fromCityId}) + 1
            });
            CityArea.set({
                id: mv.toCityId,
                value: CityArea.get({id: mv.toCityId}) - 1
            });
        } else if (mv.toCityId == 0) {
            CityArea.set({
                id: mv.fromCityId,
                value: CityArea.get({id: mv.fromCityId}) + 1
            });
        }

        // Troop updates for all players' cities
        _troopUpdate(CityPlayer.get({id: mv.fromCityId}));
        if (mv.toCityId != 0) {
            _troopUpdate(CityPlayer.get({id: mv.toCityId}));
        }
    }

    function updateCityOwnership(address player, MoveInputs memory mv) internal {
        if (mv.takingCity) {
            CityPlayer.set({id: mv.toCityId, value: player});
        }
    }

    function _incrementCityTroops(
        uint24 cityId,
        uint32 increment,
        bool isCityCenter
    ) internal {
        CityTroopCount.set({
            id: cityId,
            value: CityTroopCount.get({id: cityId}) + increment
        });
        if (isCityCenter) {
            CityCenterTroopCount.set({
                id: cityId,
                value: CityCenterTroopCount.get({id: cityId}) + increment
            });
        }
    }

    function _decrementCityTroops(
        uint24 cityId,
        uint32 decrement,
        bool isCityCenter
    ) internal {
        CityTroopCount.set({
            id: cityId,
            value: CityTroopCount.get({id: cityId}) - decrement
        });
        if (isCityCenter) {
            CityCenterTroopCount.set({
                id: cityId,
                value: CityCenterTroopCount.get({id: cityId}) - decrement
            });
        }
    }

    function _troopUpdate(address player) internal {
        uint24[] memory cities = LibCity.getCities({player: player});
        uint256 numCities = cities.length;
        uint32 totalArea = 0;
        uint32 totalTroopCount = 0;

        for (uint256 i = 0; i < numCities; i++) {
            uint24 cityId = cities[i];
            totalArea += CityArea.get({id: cityId});
            totalTroopCount += CityTroopCount.get({id: cityId});
        }
        // [TODO]: fix this formula
        // uint256 inc = ((block.number - playerLatestUpdateBlock[pkHash]) *
        //     totalArea *
        //     totalResources) / numCities;
        uint32 inc = 1;
        for (uint256 i = 0; i < numCities; i++) {
            _incrementCityTroops({
                cityId: cities[i],
                increment: inc,
                isCityCenter: true
            });
        }
        PlayerLastUpdateBlock.set({id: player, value: block.number});
    }

    function _getCurrentInterval() internal view returns (uint256) {
        return block.number / Config.getNumBlocksInInterval();
    }

    function _checkOntoSelfOrUnowned(
        address player,
        MoveInputs memory mv
    ) internal view returns (bool) {
        address toCityOwner = CityPlayer.getValue({id: mv.toCityId});
        if (toCityOwner == player || toCityOwner == address(0)) {
            return mv.ontoSelfOrUnowned;
        }
        return !mv.ontoSelfOrUnowned;
    }

    function _checkCityTroops(
        MoveInputs memory mv
    ) internal view returns (bool) {
        if (
            mv.fromIsCityCenter &&
            mv.fromCityTroops != CityTroopCount.get({id: mv.fromCityId})
        ) {
            return false;
        }
        if (
            mv.toIsCityCenter &&
            mv.toCityTroops != CityTroopCount.get({id: mv.toCityId})
        ) {
            return false;
        }
        return true;
    }

    function _getSigner(
        uint256 hUFrom,
        uint256 hUTo,
        Signature memory sig
    ) public pure returns (address) {
        bytes32 hash = keccak256(abi.encode(sig.b, hUFrom, hUTo));
        bytes32 prefixedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        return ecrecover(prefixedHash, sig.v, sig.r, sig.s);
    }
}
