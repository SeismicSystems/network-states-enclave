pragma circom 2.1.1;

include "move.func.circom";

component main { public [ currentWaterInterval, fromCityId, toCityId, 
    ontoSelfOrUnowned, numTroopsMoved, enemyLoss, fromIsCityCenter, 
    toIsCityCenter, fromIsWaterTile, toIsWaterTile, takingCity, fromCityTroops, 
    toCityTroops, hTFrom, hTTo, hUFrom, hUTo ] } = Move();
