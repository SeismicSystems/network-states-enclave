pragma circom 2.1.1;

include "move.func.circom";

component main { public [ currentInterval, fromPkHash, fromCityId, toCityId, 
    ontoSelfOrUnowned, numTroopsMoved, enemyLoss, capturedTile, takingCity, 
    takingCapital, fromTroopIncrement, toTroopIncrement, hTFrom, hTTo, hUFrom, hUTo ] 
} = Move();
