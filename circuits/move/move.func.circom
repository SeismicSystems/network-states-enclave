pragma circom 2.1.1;

include "../node_modules/maci-circuits/node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/maci-circuits/node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/maci-circuits/node_modules/circomlib/circuits/mux1.circom";
include "../node_modules/maci-circuits/node_modules/circomlib/circuits/mux2.circom";
include "../node_modules/maci-circuits/node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/maci-circuits/circom/trees/IncrementalMerkleTree.circom";
include "../utils/utils.circom";

/*
 * Whether nullifiers for the previous tile states were computed correctly.
 */
template CheckNullifiers() {
    signal input keyFrom;
    signal input keyTo;
    signal input rhoFrom;
    signal input rhoTo;

    signal output out;

    signal circuitRhoFrom <== Poseidon(1)([keyFrom]);
    signal circuitRhoTo <== Poseidon(1)([keyTo]);

    out <== BatchIsEqual(2)([[rhoFrom, circuitRhoFrom], [rhoTo, circuitRhoTo]]);
}

/*
 * Asserts 1) the hashes of the new tile states were computed correctly. 
 * It's this hiding commitment that's added to the on-chain merkle tree. 
 * 2) the player owns the 'from' tile, which is true when the player's 
 * private key corresponds to the tile's public key hash.
 */
template CheckLeaves(N_TL_ATRS) {
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input hUFrom;
    signal input hUTo;

    signal input privKeyHash;
    signal input pubKeyHash;

    signal output out;

    // Whether player 'owns' the 'from' tile
    component bjj = BabyPbk();
    bjj.in <== privKeyHash;

    signal circuitHFrom <== Poseidon(N_TL_ATRS)(uFrom);
    signal circuitHTo <== Poseidon(N_TL_ATRS)(uTo);
    signal circuitPubKeyHash <== Poseidon(2)([bjj.Ax, bjj.Ay]);

    out <== BatchIsEqual(3)([
        [pubKeyHash, circuitPubKeyHash], [hUFrom, circuitHFrom], 
        [hUTo, circuitHTo]]);
}

/*
 * A valid step entails 1) new tile states must have the same coordinates as 
 * the old states they are replacing, 2) the movement is one tile in one of
 * the cardinal directions, and 3) the to tile keeps the same type which cannot
 * be a hill.
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

    signal typesConsistent <== BatchIsEqual(2)([
        [tFrom[TYPE_IDX], uFrom[TYPE_IDX]],
        [tTo[TYPE_IDX], uTo[TYPE_IDX]]]);
        
    signal ontoHill <== IsEqual()([tTo[TYPE_IDX], HILL_TYPE]);
    signal notOntoHill <== NOT()(ontoHill);

    signal typeLogic <== AND()(typesConsistent, notOntoHill);
    
    out <== AND()(moveLogic, typeLogic);
}

/*
 * Must preserve resource management logic- what happens when armies expand to
 * unowned or enemy territories. 
 */
template CheckRsrc(N_TL_ATRS, RSRC_IDX, CITY_IDX, TRP_UPD_IDX, WTR_UPD_IDX, 
    TYPE_IDX, CITY_TYPE, CAPITAL_TYPE, WATER_TYPE, UNOWNED_ID, SYS_BITS) {
    signal input currentTroopInterval;
    signal input currentWaterInterval;
    signal input ontoSelfOrUnowned;

    signal input tFrom[N_TL_ATRS];
    signal input tTo[N_TL_ATRS];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input fromUpdatedTroops;
    signal input toUpdatedTroops;

    signal output out;

    // Properties we need to know regarding `to` tile relative to `from` tile
    signal ontoUnowned <== IsEqual()([tTo[CITY_IDX], UNOWNED_ID]);
    signal ontoSelfOrEnemy <== NOT()(ontoUnowned);
    signal ontoSelf <== AND()(ontoSelfOrUnowned, ontoSelfOrEnemy);
    signal ontoEnemy <== NOT()(ontoSelfOrUnowned);

    signal playerOnWater <== IsEqual()([tFrom[TYPE_IDX], WATER_TYPE]);
    signal enemyOnWater <== IsEqual()([tTo[TYPE_IDX], WATER_TYPE]);

    // Not allowed to move all troops off of tile
    signal movedAllTroops <== IsZero()(uFrom[RSRC_IDX]);

    // Troop updates for water and land tiles
    signal fromCheckTroopUpdates <== CheckTroopUpdates()(
        currentTroopInterval, tFrom[RSRC_IDX], 1, tFrom[TRP_UPD_IDX], 
        uFrom[TRP_UPD_IDX], fromUpdatedTroops);
    signal toCheckTroopUpdates <== CheckTroopUpdates()(
        currentTroopInterval, tTo[RSRC_IDX], ontoSelfOrEnemy, tTo[TRP_UPD_IDX], 
        uTo[TRP_UPD_IDX], toUpdatedTroops);
    signal fromCheckWaterUpdates <== CheckWaterUpdates(SYS_BITS)(
        currentWaterInterval, tFrom[RSRC_IDX], tFrom[WTR_UPD_IDX], 
        uFrom[WTR_UPD_IDX], fromUpdatedTroops);
    signal toCheckWaterUpdates <== CheckWaterUpdates(SYS_BITS)(
        currentWaterInterval, tTo[RSRC_IDX], 
        tTo[WTR_UPD_IDX], uTo[WTR_UPD_IDX], toUpdatedTroops);

    signal fromTroopUpdateCorrect <== Mux1()([fromCheckTroopUpdates, 
        fromCheckWaterUpdates], playerOnWater);
    signal toTroopUpdateCorrect <== Mux1()([toCheckTroopUpdates, 
        toCheckWaterUpdates], enemyOnWater);

    signal troopUpdatesCorrect <== AND()(fromTroopUpdateCorrect, 
        toTroopUpdateCorrect);
    signal troopUpdatesIncorrect <== NOT()(troopUpdatesCorrect);

    // Make sure resource management can't be broken via overflow
    signal overflowFrom <== GreaterEqThan(SYS_BITS)([uFrom[RSRC_IDX], 
        fromUpdatedTroops]);
    signal overflowTo <== GreaterEqThan(SYS_BITS)([uTo[RSRC_IDX], 
        fromUpdatedTroops + toUpdatedTroops]);

    signal ontoMoreOrEq <== GreaterEqThan(SYS_BITS)([toUpdatedTroops, 
        fromUpdatedTroops - uFrom[RSRC_IDX]]);

    signal rsrcLogic <== CheckRsrcCases()(fromUpdatedTroops, toUpdatedTroops,
        uFrom[RSRC_IDX], uTo[RSRC_IDX], ontoSelfOrUnowned, ontoMoreOrEq);
    signal rsrcLogicIncorrect <== NOT()(rsrcLogic);

    signal cityIdLogic <== CheckCityIdCases(CITY_TYPE, CAPITAL_TYPE)(
        tFrom[CITY_IDX], tTo[CITY_IDX], uFrom[CITY_IDX], uTo[CITY_IDX], 
        tTo[TYPE_IDX], ontoSelf, ontoEnemy, ontoMoreOrEq);
    signal cityIdLogicIncorrect <== NOT()(cityIdLogic);

    out <== BatchIsZero(6)([movedAllTroops, troopUpdatesIncorrect, overflowFrom, 
        overflowTo, rsrcLogicIncorrect, cityIdLogicIncorrect]);
}

/*
 * Asserts that the attacker's and defender's resources prior to moving reflect
 * any troop updates that should have occurred.
 */
template CheckTroopUpdates() {
    signal input currentTroopInterval;

    signal input tTroops;
    signal input isSelfOrEnemy;
    signal input tLatestUpdate;
    signal input uLatestUpdate;
    signal input updatedTroops;

    signal output out;

    // Make sure updated troop counts are computed correctly
    signal circuitUpdatedTroops <== (tTroops + currentTroopInterval 
        - tLatestUpdate) * isSelfOrEnemy;
    signal troopRsrcCorrect <== IsEqual()(
        [circuitUpdatedTroops, updatedTroops]);

    // Troop updates should be accounted for in new tile states
    signal troopsCounted <== IsEqual()([currentTroopInterval, uLatestUpdate]);

    out <== AND()(troopRsrcCorrect, troopsCounted);
}

/*
 * If a player is on the water, they should lose troops. Water updates and troop
 * updates are mutually exclusive events, and updatedTroops reflects the 
 * player's troop count post updates (both water or troop).
 */
template CheckWaterUpdates(SYS_BITS) {
    signal input currentWaterInterval;

    signal input tTroops;
    signal input tLatestUpdate;
    signal input uLatestUpdate;
    signal input updatedTroops;

    signal output out;

    // Forces updatedTroops to be 0 when all troops die
    signal notAllDead <== GreaterEqThan(SYS_BITS)([tTroops, 
        currentWaterInterval - tLatestUpdate]);

    signal circuitUpdatedTroops <== (tTroops + tLatestUpdate - 
        currentWaterInterval) * notAllDead;
    signal troopRsrcCorrect <== IsEqual()(
        [circuitUpdatedTroops, updatedTroops]);

    signal troopsCounted <== IsEqual()([currentWaterInterval, uLatestUpdate]);

    out <== AND()(troopRsrcCorrect, troopsCounted);
}

template CheckRsrcCases() {
    signal input fromUpdatedTroops;
    signal input toUpdatedTroops;
    signal input uFromTroops;
    signal input uToTroops;
    signal input ontoSelfOrUnowned;
    signal input ontoMoreOrEq;

    signal output out;

    // Moving onto enemy tile that has less resource vs what's being sent
    signal case1 <== IsEqual()(
        [fromUpdatedTroops - uFromTroops, toUpdatedTroops + uToTroops]);

    // Moving onto enemy tile that has more or eq resource vs what's being sent
    signal case2 <== IsEqual()(
        [fromUpdatedTroops - uFromTroops, toUpdatedTroops - uToTroops]);

    // Moving onto a self or unowned tile
    signal case3 <== IsEqual()(
        [fromUpdatedTroops + toUpdatedTroops, uFromTroops + uToTroops]);

    out <== Mux2()([case1, case2, case3, case3], [ontoMoreOrEq, 
        ontoSelfOrUnowned]);
}

template CheckCityIdCases(CITY_TYPE, CAPITAL_TYPE) {
    signal input tFromCityId;
    signal input tToCityId;
    signal input uFromCityId;
    signal input uToCityId;
    signal input tToType;
    signal input ontoSelf;
    signal input ontoEnemy;
    signal input ontoMoreOrEq;

    signal output out;

    // Properties we need to know to determine uTo's city ID
    signal ontoCity <== IsEqual()([tToType, CITY_TYPE]);
    signal ontoCapital <== IsEqual()([tToType, CAPITAL_TYPE]);
    signal sameCity <== IsEqual()([tFromCityId, tToCityId]);
    signal diffCity <== NOT()(sameCity);

    signal ontoCityOrCapital <== OR()(ontoCity, ontoCapital);
    signal ontoSelfDiffCity <== AND()(ontoSelf, diffCity);
    signal ontoEnemyMoreOrEq <== AND()(ontoEnemy, ontoMoreOrEq);

    signal selector <== OR()(ontoCityOrCapital, OR()(ontoSelfDiffCity, 
        ontoEnemyMoreOrEq));

    // Case when the city ID of 'to' is tFrom's city ID
    signal case1 <== IsEqual()([uToCityId, tFromCityId]);

    // Case when the city ID of 'to' remains the same
    signal case2 <== IsEqual()([uToCityId, tToCityId]);

    // From tile must remain player's after move
    signal fromOwnership <== IsEqual()([tFromCityId, uFromCityId]);

    out <== Mux1()([case1, case2], selector);
}

/*
 * The hashes of the old tiles must be included in the merkle root. If so,
 * this proves that these tiles were computed from prior moves.
 */
template CheckMerkleInclusion(N_TL_ATRS, MERKLE_TREE_DEPTH) {
    signal input root;
    
    signal input tFrom[N_TL_ATRS];
    signal input tFromPathIndices[MERKLE_TREE_DEPTH];
    signal input tFromPathElements[MERKLE_TREE_DEPTH][1];
    signal input tTo[N_TL_ATRS];
    signal input tToPathIndices[MERKLE_TREE_DEPTH];
    signal input tToPathElements[MERKLE_TREE_DEPTH][1];

    signal output out;

    signal hTFrom <== Poseidon(N_TL_ATRS)(tFrom);
    signal hTTo <== Poseidon(N_TL_ATRS)(tTo);

    signal fromPrfRoot <== MerkleTreeInclusionProof(MERKLE_TREE_DEPTH)(hTFrom,
        tFromPathIndices, tFromPathElements);
    signal toPrfRoot <== MerkleTreeInclusionProof(MERKLE_TREE_DEPTH)(hTTo,
        tToPathIndices, tToPathElements);

    out <== BatchIsEqual(2)([[root, fromPrfRoot], [root, toPrfRoot]]);
}

/*
 * Asserts 1) valid state transitions for the `from` and `to` tiles, 2) 
 * inclusion of old states in a merkle root, and 3) proper permissions to 
 * initiate the move.
 */
template Move() {
    var N_VALID_MOVES = 4;
    var VALID_MOVES[N_VALID_MOVES][2] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    var MERKLE_TREE_DEPTH = 8;

    var N_TL_ATRS = 8;
    var ROW_IDX = 0;
    var COL_IDX = 1;
    var RSRC_IDX = 2;
    var KEY_IDX = 3;
    var CITY_IDX = 4;
    var TRP_UPD_IDX = 5;
    var WTR_UPD_IDX = 6;
    var TYPE_IDX = 7;

    // cityId used to look for unowned tiles
    var UNOWNED_ID = 0;

    // Id's used to check tile type
    var CITY_TYPE = 1;
    var CAPITAL_TYPE = 2;
    var WATER_TYPE = 3;
    var HILL_TYPE = 4;

    var SYS_BITS = 252;

    signal input root;
    signal input currentTroopInterval;
    signal input currentWaterInterval;
    signal input ontoSelfOrUnowned;
    signal input hUFrom;
    signal input hUTo;
    signal input rhoFrom;
    signal input rhoTo;

    signal input tFrom[N_TL_ATRS];
    signal input tFromPathIndices[MERKLE_TREE_DEPTH];
    signal input tFromPathElements[MERKLE_TREE_DEPTH][1];
    signal input tTo[N_TL_ATRS];
    signal input tToPathIndices[MERKLE_TREE_DEPTH];
    signal input tToPathElements[MERKLE_TREE_DEPTH][1];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input fromUpdatedTroops;
    signal input toUpdatedTroops;
    signal input privKeyHash;
    signal input pubKeyHash;

    signal leavesCorrect <== CheckLeaves(N_TL_ATRS)(uFrom, 
        uTo, hUFrom, hUTo, privKeyHash, pubKeyHash);
    leavesCorrect === 1;

    signal nullifiersCorrect <== CheckNullifiers()(tFrom[KEY_IDX], 
        tTo[KEY_IDX], rhoFrom, rhoTo);
    nullifiersCorrect === 1;

    signal stepCorrect <== CheckStep(VALID_MOVES, N_VALID_MOVES, N_TL_ATRS, 
        ROW_IDX, COL_IDX, TYPE_IDX, HILL_TYPE)(tFrom, tTo, uFrom, uTo);
    stepCorrect === 1;

    signal resourcesCorrect <== CheckRsrc(N_TL_ATRS, RSRC_IDX, CITY_IDX, 
        TRP_UPD_IDX, WTR_UPD_IDX, TYPE_IDX, CITY_TYPE, CAPITAL_TYPE, WATER_TYPE, 
        UNOWNED_ID, SYS_BITS)(currentTroopInterval, currentWaterInterval, 
        ontoSelfOrUnowned, tFrom, tTo, uFrom, uTo, fromUpdatedTroops, 
        toUpdatedTroops);
    resourcesCorrect === 1;

    signal merkleProofCorrect <== CheckMerkleInclusion(N_TL_ATRS,
        MERKLE_TREE_DEPTH)(root, tFrom, tFromPathIndices, tFromPathElements,
        tTo, tToPathIndices, tToPathElements);
    merkleProofCorrect === 1;
}
