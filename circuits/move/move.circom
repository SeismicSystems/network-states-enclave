pragma circom 2.1.1;

include "move.func.circom";

component main { public [ currentTroopInterval, currentWaterInterval, 
    fromPkHash, fromCityId, toCityId, ontoSelfOrUnowned, takingCity, 
    takingCapital, hTFrom, hTTo, hUFrom, hUTo ] } = Move();
