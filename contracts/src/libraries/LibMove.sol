// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {City, CityPlayer, Config, PlayerLastUpdateBlock, TileCommitment} from "codegen/index.sol";
import {Move, MoveInputs} from "common/MoveInputs.sol";
import {Signature} from "common/Signature.sol";
import {LibCity} from "libraries/LibCity.sol";

library LibMove {

    /// @notice Fills in various arguments to convert the passed Move struct into the MoveInputs necessary for the zk proof
    function getMoveInputs(Move memory move) internal view returns(MoveInputs memory) {
        return MoveInputs({
            fromIsCityCenter: move.fromIsCityCenter,
            toIsCityCenter: move.toIsCityCenter,
            fromIsWaterTile: move.fromIsWaterTile,
            toIsWaterTile: move.toIsWaterTile,
            takingCity: move.takingCity,
            ontoSelfOrUnowned: move.ontoSelfOrUnowned,
            fromCityId: move.fromCityId,
            toCityId: move.toCityId,
            fromCityTroops: City.getCenterTroopCount({id: move.fromCityId}),
            toCityTroops: City.getCenterTroopCount({id: move.toCityId}),
            numTroopsMoved: move.numTroopsMoved,
            enemyLoss: move.enemyLoss,
            currentInterval: move.currentInterval,
            hTFrom: move.hTFrom,
            hTTo: move.hTTo,
            hUFrom: move.hUFrom,
            hUTo: move.hUTo
        });
    }

    /// @notice Runs various checks for the move
    function checkMoveInputs(
        address player,
        MoveInputs memory moveInputs,
        Signature memory sig
    ) internal view {
        require(
            TileCommitment.getValue({id: moveInputs.hTFrom}),
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
            CityPlayer.get(moveInputs.fromCityId) == player,
            "Must own tile player moves from"
        );
        require(
            _checkOntoSelfOrUnowned({player: player, mv: moveInputs}),
            "Incorrect ontoSelfOrUnowned"
        );
        require(
            _checkCityTroops({mv: moveInputs}),
            "Incorrect (from/to) CityTroops"
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

    function updateCityTroopCountsBeforeMove(Move memory mv) internal {
        _troopUpdate(CityPlayer.get({id: mv.fromCityId}));
        if (mv.toCityId != 0) {
            _troopUpdate(CityPlayer.get({id: mv.toCityId}));
        }
    }

    function updateCityTroopCountsAfterMove(MoveInputs memory mv) internal {
        if (mv.fromIsWaterTile) {
            LibCity.incrementCityTroops({
                cityId: mv.fromCityId,
                increment: mv.numTroopsMoved,
                isCityCenter: mv.fromIsCityCenter
            });
        }
        if (mv.toIsWaterTile) {
            LibCity.decrementCityTroops({
                cityId: mv.fromCityId,
                decrement: mv.numTroopsMoved - mv.enemyLoss,
                isCityCenter: mv.toIsCityCenter
            });
        }

        if (
            mv.takingCity ||
            (mv.ontoSelfOrUnowned && mv.toCityId != 0)
        ) {
            // Taking city, or moving onto self-owned tile
            LibCity.decrementCityTroops({
                cityId: mv.fromCityId,
                decrement: mv.numTroopsMoved,
                isCityCenter: mv.fromIsCityCenter
            });
        } else if (!mv.ontoSelfOrUnowned) {
            // Capturing enemy non-city tile or attacking enemy
            LibCity.decrementCityTroops({
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
            LibCity.incrementCityTroops({
                cityId: mv.toCityId,
                increment: mv.numTroopsMoved,
                isCityCenter: mv.toIsCityCenter
            });
        } else if (mv.takingCity) {
            // Taking enemy city
            LibCity.incrementCityTroops({
                cityId: mv.toCityId,
                increment: mv.numTroopsMoved - mv.enemyLoss,
                isCityCenter: mv.toIsCityCenter
            });
        } else if (!mv.ontoSelfOrUnowned) {
            // Capturing enemy non-city tile or attacking enemy
            LibCity.decrementCityTroops({
                cityId: mv.toCityId,
                decrement: mv.enemyLoss,
                isCityCenter: mv.toIsCityCenter
            });
        }

        if (!mv.ontoSelfOrUnowned && !mv.takingCity) {
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
    }

    function updateCityOwnership(
        address player,
        MoveInputs memory mv
    ) internal {
        if (mv.takingCity) {
            CityPlayer.set({id: mv.toCityId, value: player});
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

    function _troopUpdate(address player) internal {
        uint24[] memory cities = LibCity.getCities({player: player});
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
            LibCity.incrementCityTroops({
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
        address toCityOwner = CityPlayer.get({id: mv.toCityId});
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
            mv.fromCityTroops != City.getCenterTroopCount({id: mv.fromCityId})
        ) {
            return false;
        }
        if (
            mv.toIsCityCenter &&
            mv.toCityTroops != City.getCenterTroopCount({id: mv.toCityId})
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
