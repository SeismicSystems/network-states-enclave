// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

struct MoveInputs {
    bool fromIsCityCenter;
    bool toIsCityCenter;
    bool fromIsWaterTile;
    bool toIsWaterTile;
    bool takingCity;
    bool ontoSelfOrUnowned;
    uint24 fromCityId;
    uint24 toCityId;
    uint32 fromCityTroops;
    uint32 toCityTroops;
    uint32 numTroopsMoved;
    uint32 enemyLoss;
    uint256 currentInterval;
    uint256 hTFrom;
    uint256 hTTo;
    uint256 hUFrom;
    uint256 hUTo;
}
