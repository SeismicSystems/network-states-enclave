pragma circom 2.1.1;

include "move.func.circom";

component main { public [ root, currentTroopInterval, currentWaterInterval, 
    fromPkHash, fromCityId, toCityId, ontoSelfOrUnowned, takingCity, 
    takingCapital, hUFrom, hUTo, rhoFrom, rhoTo ] } = Move();
