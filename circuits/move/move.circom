pragma circom 2.1.1;

include "move.func.circom";

component main { public [ currentInterval, fromPkHash, fromCityId, toCityId, 
    ontoSelfOrUnowned, numTroopsMoved, enemyLoss, fromIsCityTile, 
    toIsCityTile, takingCity, takingCapital, fromCityTroops, toCityTroops, 
    hTFrom, hTTo, hUFrom, hUTo ] } = Move();
