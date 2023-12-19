pragma circom 2.1.1;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";
include "../node_modules/circomlib/circuits/mux2.circom";
include "../utils/utils.circom";

template CheckTileHash(N_TL_ATRS) {
    signal input tileHash;
    signal input tile[N_TL_ATRS];

    signal output out;

    signal circuitTileHash <== Poseidon(N_TL_ATRS)(tile);

    out <== IsEqual()([circuitTileHash, tileHash]);
}

/*
 * Asserts that the commitments for all tile states were computed correctly.
 */
template CheckTileHashes(N_TL_ATRS) {
    signal input hTFrom;
    signal input hTTo;
    signal input hUFrom;
    signal input hUTo;

    signal input tFrom[N_TL_ATRS];
    signal input tTo[N_TL_ATRS];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];

    signal output out;

    // Whether hashes were computed correctly
    signal hTFromCorrect <== CheckTileHash(N_TL_ATRS)(hTFrom, tFrom);
    signal hTFromIncorrect <== NOT()(hTFromCorrect);

    signal hTToCorrect <== CheckTileHash(N_TL_ATRS)(hTTo, tTo);
    signal hTToIncorrect <== NOT()(hTToCorrect);

    signal hUFromCorrect <== CheckTileHash(N_TL_ATRS)(hUFrom, uFrom);
    signal hUFromIncorrect <== NOT()(hUFromCorrect);

    signal hUToCorrect <== CheckTileHash(N_TL_ATRS)(hUTo, uTo);
    signal hUToIncorrect <== NOT()(hUToCorrect);

    out <== BatchIsZero(4)([hTFromIncorrect, hTToIncorrect, 
        hUFromIncorrect, hUToIncorrect]);
}

/*
 * A valid step entails 1) new tile states must have the same coordinates as 
 * the old states they are replacing, 2) the movement is one tile in one of
 * the cardinal directions, and 3) the to tile cannot be a hill.
 */
template CheckStep(VALID_MOVES, N_VALID_MOVES, N_TL_ATRS, ROW_IDX, COL_IDX, 
    TYPE_IDX, HILL_TYPE) {
    signal input tFrom[N_TL_ATRS];
    signal input tTo[N_TL_ATRS];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];

    signal output out;

    signal positionsConsistent <== BatchIsEqual(4)([
        [tFrom[ROW_IDX], uFrom[ROW_IDX]], [tFrom[COL_IDX], uFrom[COL_IDX]], 
        [tTo[ROW_IDX], uTo[ROW_IDX]], [tTo[COL_IDX], uTo[COL_IDX]]]);

    signal step[2] <== [tTo[ROW_IDX] - tFrom[ROW_IDX], 
        tTo[COL_IDX] - tFrom[COL_IDX]];
    signal stepValid <== PairArrayContains(N_VALID_MOVES)(VALID_MOVES, step);

    signal moveLogic <== AND()(positionsConsistent, stepValid);
        
    signal ontoHill <== IsEqual()([tTo[TYPE_IDX], HILL_TYPE]);
    signal notOntoHill <== NOT()(ontoHill);
    
    out <== AND()(moveLogic, notOntoHill);
}

/*
 * Must preserve resource management logic- what happens when armies expand to
 * unowned or enemy territories. 
 */
template CheckRsrc(N_TL_ATRS, RSRC_IDX, CITY_IDX, UPD_IDX, TYPE_IDX, CITY_TYPE, 
    WATER_TYPE, UNOWNED_ID, SYS_BITS) {
    signal input currentWaterInterval;
    signal input ontoSelfOrUnowned;
    signal input fromCityTroops;
    signal input toCityTroops;

    signal input tFrom[N_TL_ATRS];
    signal input tTo[N_TL_ATRS];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input fromUpdatedTroops;
    signal input toUpdatedTroops;
    signal input ontoMoreOrEq;

    signal output out;

    // Properties we need to know regarding `to` tile relative to `from` tile
    signal ontoUnowned <== IsEqual()([tTo[CITY_IDX], UNOWNED_ID]);
    signal ontoSelfOrEnemy <== NOT()(ontoUnowned);
    signal ontoSelf <== AND()(ontoSelfOrUnowned, ontoSelfOrEnemy);
    signal ontoEnemy <== NOT()(ontoSelfOrUnowned);

    // Not allowed to move all troops off of tile
    signal movedAllTroops <== IsZero()(uFrom[RSRC_IDX]);

    // Troop updates: water and city tiles
    signal fromTroopUpdatesCorrect <== CheckTroopUpdates(N_TL_ATRS, RSRC_IDX, 
        CITY_IDX, UPD_IDX, TYPE_IDX, UNOWNED_ID, CITY_TYPE, WATER_TYPE, 
        SYS_BITS)(currentWaterInterval, fromCityTroops, tFrom, uFrom,
        fromUpdatedTroops);
    signal toTroopUpdatesCorrect <== CheckTroopUpdates(N_TL_ATRS, RSRC_IDX, 
        CITY_IDX, UPD_IDX, TYPE_IDX, UNOWNED_ID, CITY_TYPE, WATER_TYPE, 
        SYS_BITS)(currentWaterInterval, toCityTroops, tTo, uTo,
        toUpdatedTroops);
    signal troopUpdatesCorrect <== AND()(fromTroopUpdatesCorrect, 
        toTroopUpdatesCorrect);
    signal troopUpdatesIncorrect <== NOT()(troopUpdatesCorrect);

    // Make sure resource management can't be broken via overflow
    signal overflowFrom <== GreaterEqThan(SYS_BITS)([uFrom[RSRC_IDX], 
        fromUpdatedTroops]);
    signal overflowTo <== GreaterEqThan(SYS_BITS)([uTo[RSRC_IDX], 
        fromUpdatedTroops + toUpdatedTroops]);

    signal rsrcLogic <== CheckRsrcCases(N_TL_ATRS, RSRC_IDX)(ontoSelfOrUnowned, 
        uFrom, uTo, fromUpdatedTroops, toUpdatedTroops, ontoMoreOrEq);
    signal rsrcLogicIncorrect <== NOT()(rsrcLogic);

    signal cityIdLogic <== CheckCityIdCases(N_TL_ATRS, CITY_IDX, TYPE_IDX, 
        CITY_TYPE)(tFrom, tTo, uFrom, uTo, ontoSelf, ontoEnemy, ontoMoreOrEq);
    signal cityIdLogicIncorrect <== NOT()(cityIdLogic);

    signal typeLogic <== BatchIsEqual(2)([
        [tFrom[TYPE_IDX], uFrom[TYPE_IDX]],
        [tTo[TYPE_IDX], uTo[TYPE_IDX]]
    ]);
    signal typeLogicIncorrect <== NOT()(typeLogic);

    out <== BatchIsZero(7)([movedAllTroops, troopUpdatesIncorrect, overflowFrom, 
        overflowTo, rsrcLogicIncorrect, cityIdLogicIncorrect, 
        typeLogicIncorrect]);
}

/*
 * Ensures that the updatedTroops signal reflects the number of resources at a
 * tile post-troop/water update. A city update should add troopIncrement's, and
 * a water update should remove troops.
 */
template CheckTroopUpdates(N_TL_ATRS, RSRC_IDX, CITY_IDX, UPD_IDX, TYPE_IDX, 
    UNOWNED_ID, CITY_TYPE, WATER_TYPE, SYS_BITS) {
        signal input currentWaterInterval;
        signal input cityTroops;

        signal input tTile[N_TL_ATRS];
        signal input uTile[N_TL_ATRS];
        signal input updatedTroops;

        signal output out;

        signal waterTile <== IsEqual()([tTile[TYPE_IDX], WATER_TYPE]);
        signal cityTile <== IsEqual()([tTile[TYPE_IDX], CITY_TYPE]);

        // Not a water or city tile
        signal case1 <== IsEqual()([updatedTroops, tTile[RSRC_IDX]]);

        // Water tile
        signal case2 <== CheckWaterUpdates(N_TL_ATRS, RSRC_IDX, UPD_IDX, 
            TYPE_IDX, WATER_TYPE, SYS_BITS)(currentWaterInterval, tTile, 
            updatedTroops);

        // City tile. cityTroops will be constrained by the contract
        signal case3 <== IsEqual()(
            [updatedTroops, cityTroops]);

        signal updateCorrect <== Mux2()(
            [case1, case2, case3, case3], [waterTile, cityTile]);

        // The new latestUpdateInterval of the tile should be currentWaterInterval
        signal troopsCounted <== IsEqual()([uTile[UPD_IDX], currentWaterInterval]);

        out <== AND()(updateCorrect, troopsCounted);
}

/*
 * If a player is on the water, they should lose troops. Constrains
 * updatedTroops post water update, assuming that the tile is a water tile.
 */
template CheckWaterUpdates(N_TL_ATRS, RSRC_IDX, UPD_IDX, TYPE_IDX, 
    WATER_TYPE, SYS_BITS) {
    signal input currentWaterInterval;

    signal input tTile[N_TL_ATRS];
    signal input updatedTroops;

    signal output out;

    // Forces updatedTroops to be 0 when all troops die
    signal notAllDead <== GreaterEqThan(SYS_BITS)([tTile[RSRC_IDX], 
        currentWaterInterval - tTile[UPD_IDX]]);

    // Updated troop count if tile is a water tile
    signal circuitUpdatedTroops <== (tTile[RSRC_IDX] + tTile[UPD_IDX] - 
        currentWaterInterval) * notAllDead;

    // The water update applies if onWater is true
    out <== IsEqual()([circuitUpdatedTroops, updatedTroops]);
}

template CheckRsrcCases(N_TL_ATRS, RSRC_IDX) {
    signal input ontoSelfOrUnowned;

    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input fromUpdatedTroops;
    signal input toUpdatedTroops;
    signal input ontoMoreOrEq;

    signal output out;

    // Moving onto enemy tile that has less resource vs what's being sent
    signal case1 <== IsEqual()(
        [fromUpdatedTroops - uFrom[RSRC_IDX], toUpdatedTroops + uTo[RSRC_IDX]]);

    // Moving onto enemy tile that has more or eq resource vs what's being sent
    signal case2 <== IsEqual()(
        [fromUpdatedTroops - uFrom[RSRC_IDX], toUpdatedTroops - uTo[RSRC_IDX]]);

    // Moving onto a self or unowned tile
    signal case3 <== IsEqual()(
        [fromUpdatedTroops + toUpdatedTroops, uFrom[RSRC_IDX] + uTo[RSRC_IDX]]);

    out <== Mux2()([case1, case2, case3, case3], [ontoMoreOrEq, 
        ontoSelfOrUnowned]);
}

template CheckCityIdCases(N_TL_ATRS, CITY_IDX, TYPE_IDX, CITY_TYPE) {
    signal input tFrom[N_TL_ATRS];
    signal input tTo[N_TL_ATRS];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input ontoSelf;
    signal input ontoEnemy;
    signal input ontoMoreOrEq;

    signal output out;

    // Properties we need to know to determine uTo's city ID
    signal ontoCity <== IsEqual()([tTo[TYPE_IDX], CITY_TYPE]);
    signal sameCity <== IsEqual()([tFrom[CITY_IDX], tTo[CITY_IDX]]);
    signal diffCity <== NOT()(sameCity);

    // Cases when city ID of 'to' should not change
    signal ontoSelfDiffCity <== AND()(ontoSelf, diffCity);
    signal ontoEnemyMoreOrEq <== AND()(ontoEnemy, ontoMoreOrEq);

    signal selector <== OR()(ontoCity, OR()(ontoSelfDiffCity, 
        ontoEnemyMoreOrEq));

    // Case when the city ID of 'to' is tFrom's city ID
    signal case1 <== IsEqual()([uTo[CITY_IDX], tFrom[CITY_IDX]]);

    // Case when the city ID of 'to' remains the same
    signal case2 <== IsEqual()([uTo[CITY_IDX], tTo[CITY_IDX]]);

    signal caseLogic <== Mux1()([case1, case2], selector);

    // From tile must remain player's after move
    signal fromOwnership <== IsEqual()([tFrom[CITY_IDX], uFrom[CITY_IDX]]);

    out <== AND()(caseLogic, fromOwnership);
}

/*
 * Checks that the public signals that the contract logic uses are computed
 * correctly.
 */
template CheckPublicSignals(N_TL_ATRS, RSRC_IDX, CITY_IDX, UNOWNED_ID, TYPE_IDX, 
    CITY_TYPE, WATER_TYPE) {
    signal input fromCityId;
    signal input toCityId;
    signal input ontoSelfOrUnowned;
    signal input numTroopsMoved;
    signal input enemyLoss;
    signal input fromIsCityCenter;
    signal input toIsCityCenter;
    signal input fromIsWaterTile;
    signal input toIsWaterTile;
    signal input takingCity;

    signal input ontoMoreOrEq;
    signal input tFrom[N_TL_ATRS];
    signal input tTo[N_TL_ATRS];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input fromUpdatedTroops;
    signal input toUpdatedTroops;

    signal output out;

    // City Ids are consistent with tile states
    signal fromCityIdCorrect <== IsEqual()([fromCityId, tFrom[CITY_IDX]]);
    signal toCityIdCorrect <== IsEqual()([toCityId, tTo[CITY_IDX]]);
    signal cityIdCorrect <== AND()(fromCityIdCorrect, toCityIdCorrect);
    signal cityIdIncorrect <== NOT()(cityIdCorrect);

    // numTroopsMoved is before - after
    signal numTroopsMovedCorrect <== IsEqual()(
        [numTroopsMoved, fromUpdatedTroops - uFrom[RSRC_IDX]]);
    signal numTroopsMovedIncorrect <== NOT()(numTroopsMovedCorrect);

    // enemyLoss is number of troops that the enemy loses in a move
    signal circuitEnemyLoss <== Mux1()(
        [toUpdatedTroops, numTroopsMoved], ontoMoreOrEq);
    signal enemyLossCorrect <== IsEqual()([enemyLoss, circuitEnemyLoss]);
    signal enemyLossIncorrect <== NOT()(enemyLossCorrect);

    // Capturing requires moving more troops than on the to tile
    signal ontoLess <== NOT()(ontoMoreOrEq);

    // Cannot 'capture' your own city
    signal ontoUnowned <== IsEqual()([toCityId, UNOWNED_ID]);
    signal notOntoUnowned <== NOT()(ontoUnowned);
    signal ontoSelf <== AND()(ontoSelfOrUnowned, notOntoUnowned);
    signal notOntoSelf <== NOT()(ontoSelf);

    signal capturedTile <== AND()(ontoLess, notOntoSelf);

    signal fromCity <== IsEqual()([tFrom[TYPE_IDX], CITY_TYPE]);
    signal ontoCity <== IsEqual()([tTo[TYPE_IDX], CITY_TYPE]);
    signal circuitTakingCity <== AND()(ontoCity, capturedTile);
    signal takingCityCorrect <== IsEqual()([takingCity, circuitTakingCity]);
    signal takingCityIncorrect <== NOT()(takingCityCorrect);

    signal fromIsCityCenterCorrect <== IsEqual()([fromIsCityCenter, fromCity]);
    signal toIsCityCenterCorrect <== IsEqual()([toIsCityCenter, ontoCity]);
    signal isCityCorrect <== AND()(fromIsCityCenterCorrect, toIsCityCenterCorrect);
    signal isCityIncorrect <== NOT()(isCityCorrect);

    signal circuitFromWater <== IsEqual()([tFrom[TYPE_IDX], WATER_TYPE]);
    signal fromWaterCorrect <== IsEqual()([circuitFromWater, fromIsWaterTile]);
    signal circuitToWater <== IsEqual()([tTo[TYPE_IDX], WATER_TYPE]);
    signal toWaterCorrect <== IsEqual()([circuitToWater, toIsWaterTile]);
    signal waterCorrect <== AND()(fromWaterCorrect, toWaterCorrect);
    signal waterIncorrect <== NOT()(waterCorrect);

    out <== BatchIsZero(6)([cityIdIncorrect, numTroopsMovedIncorrect, 
        enemyLossIncorrect, takingCityIncorrect, isCityIncorrect, 
        waterIncorrect]);
}

/*
 * Asserts 1) valid state transitions for the `from` and `to` tiles, 2) 
 * old states are on-chain as hashes, and 3) proper permissions to 
 * initiate the move.
 */
template Move() {
    var N_VALID_MOVES = 4;
    var VALID_MOVES[N_VALID_MOVES][2] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    var N_TL_ATRS = 7;
    var ROW_IDX = 0;
    var COL_IDX = 1;
    var RSRC_IDX = 2;
    var KEY_IDX = 3;
    var CITY_IDX = 4;
    var UPD_IDX = 5;
    var TYPE_IDX = 6;

    // cityId used to look for unowned tiles
    var UNOWNED_ID = 0;

    // Id's used to check tile type
    var CITY_TYPE = 1;
    var WATER_TYPE = 2;
    var HILL_TYPE = 3;

    var SYS_BITS = 252;

    signal input currentWaterInterval;
    signal input fromCityId;
    signal input toCityId;
    signal input ontoSelfOrUnowned;
    signal input numTroopsMoved;
    signal input enemyLoss;
    signal input fromIsCityCenter;
    signal input toIsCityCenter;
    signal input fromIsWaterTile;
    signal input toIsWaterTile;
    signal input takingCity;
    signal input fromCityTroops;
    signal input toCityTroops;
    signal input hTFrom;
    signal input hTTo;
    signal input hUFrom;
    signal input hUTo;

    signal input tFrom[N_TL_ATRS];
    signal input tTo[N_TL_ATRS];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input fromUpdatedTroops;
    signal input toUpdatedTroops;

    signal ontoMoreOrEq <== GreaterEqThan(SYS_BITS)([toUpdatedTroops, 
        numTroopsMoved]);

    signal pubSignalsCorrect <== CheckPublicSignals(N_TL_ATRS, RSRC_IDX, 
        CITY_IDX, UNOWNED_ID, TYPE_IDX, CITY_TYPE, WATER_TYPE)(fromCityId, 
        toCityId, ontoSelfOrUnowned, numTroopsMoved, enemyLoss, 
        fromIsCityCenter, toIsCityCenter, fromIsWaterTile, toIsWaterTile, 
        takingCity, ontoMoreOrEq, tFrom, tTo, uFrom, uTo, fromUpdatedTroops, 
        toUpdatedTroops);
    pubSignalsCorrect === 1;

    signal authCorrect <== CheckTileHashes(N_TL_ATRS)(hTFrom, hTTo, hUFrom, hUTo,
        tFrom, tTo, uFrom, uTo);
    authCorrect === 1;

    signal stepCorrect <== CheckStep(VALID_MOVES, N_VALID_MOVES, N_TL_ATRS, 
        ROW_IDX, COL_IDX, TYPE_IDX, HILL_TYPE)(tFrom, tTo, uFrom, uTo);
    stepCorrect === 1;

    signal resourcesCorrect <== CheckRsrc(N_TL_ATRS, RSRC_IDX, CITY_IDX, 
        UPD_IDX, TYPE_IDX, CITY_TYPE, WATER_TYPE, UNOWNED_ID, SYS_BITS)
        (currentWaterInterval, ontoSelfOrUnowned, fromCityTroops, toCityTroops, 
        tFrom, tTo, uFrom, uTo, fromUpdatedTroops, toUpdatedTroops, 
        ontoMoreOrEq);
    resourcesCorrect === 1;
}
