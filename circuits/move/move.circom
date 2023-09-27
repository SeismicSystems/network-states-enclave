pragma circom 2.1.1;

include "move.func.circom";

component main { public [ root, currentTroopInterval, currentWaterInterval, 
    fromPkHash, toPkHash, fromCityId, toCityId, ontoSelfOrUnowned, hUFrom, hUTo, 
    rhoFrom, rhoTo ] } = Move();
