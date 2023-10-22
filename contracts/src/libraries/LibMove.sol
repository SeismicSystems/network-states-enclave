// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {City, CityPlayer, Config, PlayerLastUpdateBlock, TileCommitment} from "codegen/index.sol";
import {MoveInputs} from "common/MoveInputs.sol";
import {Signature} from "common/Signature.sol";
import {LibCity} from "libraries/LibCity.sol";

library LibMove {
    /// @notice Runs various checks for the move
    function checkMoveInputs(
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
            moveInputs.fromPkHash ==
                CityPlayer.getValue({id: moveInputs.fromCityId}),
            "Must move owned city"
        );
        require(
            _checkOntoSelfOrUnowned({mv: moveInputs}),
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
            City.setCenterTroopCount({
                id: mv.fromCityId,
                centerTroopCount: City.getCenterTroopCount({
                    id: mv.fromCityId
                }) - mv.numTroopsMoved
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
            City.setArea({
                id: mv.fromCityId,
                area: City.getArea({id: mv.fromCityId}) + 1
            });
            City.setArea({
                id: mv.toCityId,
                area: City.getArea({id: mv.toCityId}) - 1
            });
        } else if (mv.toCityId == 0) {
            City.setArea({
                id: mv.fromCityId,
                area: City.getArea({id: mv.fromCityId}) + 1
            });
        }

        // Troop updates for all players' cities
        _troopUpdate(CityPlayer.get({id: mv.fromCityId}));
        if (mv.toCityId != 0) {
            _troopUpdate(CityPlayer.get({id: mv.toCityId}));
        }
    }

    function updateCityOwnership(MoveInputs memory mv) internal {
        if (mv.takingCity) {
            CityPlayer.set({id: mv.toCityId, value: mv.fromPkHash});
        }
    }

    function _incrementCityTroops(
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

    function _decrementCityTroops(
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

    function _troopUpdate(uint256 pkHash) internal {
        uint24[] memory cities = LibCity.getCities({pkHash: pkHash});
        uint256 numCities = cities.length;
        uint32 totalArea = 0;
        uint32 totalTroopCount = 0;

        for (uint256 i = 0; i < numCities; i++) {
            uint24 cityId = cities[i];
            totalArea += City.getArea({id: cityId});
            totalTroopCount += City.getTroopCount({id: cityId});
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
        PlayerLastUpdateBlock.set({pkHash: pkHash, value: block.number});
    }

    function _getCurrentInterval() internal view returns (uint256) {
        return block.number / Config.getNumBlocksInInterval();
    }

    function _checkOntoSelfOrUnowned(
        MoveInputs memory mv
    ) internal view returns (bool) {
        uint256 toCityOwner = CityPlayer.get({id: mv.toCityId});
        if (toCityOwner == mv.fromPkHash || toCityOwner == 0) {
            return mv.ontoSelfOrUnowned;
        }
        return !mv.ontoSelfOrUnowned;
    }

    function _checkCityTroops(
        MoveInputs memory mv
    ) internal view returns (bool) {
        bool fromCorrect = true;
        bool toCorrect = true;
        if (
            mv.fromIsCityCenter &&
            mv.fromCityTroops != City.getTroopCount({id: mv.fromCityId})
        ) {
            fromCorrect = false;
        }
        if (
            mv.toIsCityCenter &&
            mv.toCityTroops != City.getTroopCount({id: mv.toCityId})
        ) {
            toCorrect = false;
        }
        return fromCorrect && toCorrect;
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
