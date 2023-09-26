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

    // Not allowed to move all troops off of tile
    signal movedAllTroops <== IsZero()(uFrom[RSRC_IDX]);

    // Updates for water tiles
    signal fromCheckWaterUpdates <== CheckWaterUpdates(N_TL_ATRS, RSRC_IDX,
        WTR_UPD_IDX, TYPE_IDX, WATER_TYPE, SYS_BITS)(currentWaterInterval, 
        tFrom, uFrom, fromUpdatedTroops);
    signal toCheckWaterUpdates <== CheckWaterUpdates(N_TL_ATRS, RSRC_IDX,
        WTR_UPD_IDX, TYPE_IDX, WATER_TYPE, SYS_BITS)(currentWaterInterval, tTo, 
        uTo, toUpdatedTroops);

    signal waterUpdatesCorrect <== AND()(fromCheckWaterUpdates, 
        toCheckWaterUpdates);
    signal waterUpdatesIncorrect <== NOT()(waterUpdatesCorrect);

    // Make sure resource management can't be broken via overflow
    signal overflowFrom <== GreaterEqThan(SYS_BITS)([uFrom[RSRC_IDX], 
        fromUpdatedTroops]);
    signal overflowTo <== GreaterEqThan(SYS_BITS)([uTo[RSRC_IDX], 
        fromUpdatedTroops + toUpdatedTroops]);

    signal ontoMoreOrEq <== GreaterEqThan(SYS_BITS)([toUpdatedTroops, 
        fromUpdatedTroops - uFrom[RSRC_IDX]]);

    signal rsrcLogic <== CheckRsrcCases(N_TL_ATRS, RSRC_IDX)(uFrom, uTo, 
        fromUpdatedTroops, toUpdatedTroops, ontoSelfOrUnowned, ontoMoreOrEq);
    signal rsrcLogicIncorrect <== NOT()(rsrcLogic);

    signal cityIdLogic <== CheckCityIdCases(N_TL_ATRS, CITY_IDX, TYPE_IDX, 
        CITY_TYPE, CAPITAL_TYPE)(tFrom, tTo, uFrom, uTo, ontoSelf, ontoEnemy, 
        ontoMoreOrEq);
    signal cityIdLogicIncorrect <== NOT()(cityIdLogic);

    signal typeLogic <== CheckTypeConsistency(N_TL_ATRS, TYPE_IDX, CITY_TYPE,
        CAPITAL_TYPE)(tFrom, tTo, uFrom, uTo, ontoEnemy, ontoMoreOrEq);
    signal typeLogicIncorrect <== NOT()(typeLogic);



    out <== BatchIsZero(7)([movedAllTroops, waterUpdatesIncorrect, overflowFrom, 
        overflowTo, rsrcLogicIncorrect, cityIdLogicIncorrect, 
        typeLogicIncorrect]);
}

/*
 * Asserts that the attacker's and defender's resources prior to moving reflect
 * any troop updates that should have occurred.
 */
template CheckTroopUpdates(N_TL_ATRS, RSRC_IDX, TRP_UPD_IDX) {
    signal input currentTroopInterval;

    signal input tTile[N_TL_ATRS];
    signal input uTile[N_TL_ATRS];
    signal input updatedTroops;
    signal input isSelfOrEnemy;

    signal output out;

    // Make sure updated troop counts are computed correctly
    signal circuitUpdatedTroops <== (tTile[RSRC_IDX] + currentTroopInterval 
        - tTile[TRP_UPD_IDX]) * isSelfOrEnemy;
    signal troopRsrcCorrect <== IsEqual()(
        [circuitUpdatedTroops, updatedTroops]);

    // Troop updates should be accounted for in new tile states
    signal troopsCounted <== IsEqual()(
        [currentTroopInterval, uTile[TRP_UPD_IDX]]);

    out <== AND()(troopRsrcCorrect, troopsCounted);
}

/*
 * If a player is on the water, they should lose troops. Constrains
 * updatedTroops post water update.
 */
template CheckWaterUpdates(N_TL_ATRS, RSRC_IDX, WTR_UPD_IDX, TYPE_IDX, 
    WATER_TYPE, SYS_BITS) {
    signal input currentWaterInterval;

    signal input tTile[N_TL_ATRS];
    signal input uTile[N_TL_ATRS];
    signal input updatedTroops;

    signal output out;

    signal onWater <== IsEqual()([tTile[TYPE_IDX], WATER_TYPE]);

    // Forces updatedTroops to be 0 when all troops die
    signal notAllDead <== GreaterEqThan(SYS_BITS)([tTile[RSRC_IDX], 
        currentWaterInterval - tTile[WTR_UPD_IDX]]);

    // Updated troop count if tile is a water tile
    signal circuitUpdatedTroops <== (tTile[RSRC_IDX] + tTile[WTR_UPD_IDX] - 
        currentWaterInterval) * notAllDead;

    // Case when on a non-water tile
    signal case1 <== IsEqual()([updatedTroops, tTile[RSRC_IDX]]);

    // Case when on a water tile
    signal case2 <== IsEqual()([updatedTroops, circuitUpdatedTroops]);

    // The water update applies iff onWater is true
    signal troopRsrcCorrect <== Mux1()([case1, case2], onWater);

    signal troopsCounted <== IsEqual()(
        [currentWaterInterval, uTile[WTR_UPD_IDX]]);

    out <== AND()(troopRsrcCorrect, troopsCounted);
}

template CheckRsrcCases(N_TL_ATRS, RSRC_IDX) {
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input fromUpdatedTroops;
    signal input toUpdatedTroops;
    signal input ontoSelfOrUnowned;
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

template CheckCityIdCases(N_TL_ATRS, CITY_IDX, TYPE_IDX, CITY_TYPE, 
    CAPITAL_TYPE) {
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
    signal ontoCapital <== IsEqual()([tTo[TYPE_IDX], CAPITAL_TYPE]);
    signal sameCity <== IsEqual()([tFrom[CITY_IDX], tTo[CITY_IDX]]);
    signal diffCity <== NOT()(sameCity);

    // Cases when city ID of 'to' should not change
    signal ontoCityOrCapital <== OR()(ontoCity, ontoCapital);
    signal ontoSelfDiffCity <== AND()(ontoSelf, diffCity);
    signal ontoEnemyMoreOrEq <== AND()(ontoEnemy, ontoMoreOrEq);

    signal selector <== OR()(ontoCityOrCapital, OR()(ontoSelfDiffCity, 
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

template CheckTypeConsistency(N_TL_ATRS, TYPE_IDX, CITY_TYPE, CAPITAL_TYPE) {
    signal input tFrom[N_TL_ATRS];
    signal input tTo[N_TL_ATRS];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input ontoEnemy;
    signal input ontoMoreOrEq;

    signal output out;

    // 'from' tile's type should always remain the same
    signal fromTypeCorrect <== IsEqual()([uFrom[TYPE_IDX], tFrom[TYPE_IDX]]);

    signal ontoCapital <== IsEqual()([tTo[TYPE_IDX], CAPITAL_TYPE]);
    signal ontoLess <== NOT()(ontoMoreOrEq);
    signal capturingEnemy <== AND()(ontoEnemy, ontoLess);
    signal capturingCapital <== AND()(ontoCapital, capturingEnemy);

    // Unless capturing an enemy capital, the 'to' tile's type should not change
    signal case1 <== IsEqual()([uTo[TYPE_IDX], tTo[TYPE_IDX]]);

    // Capital turns into a city
    signal case2 <== IsEqual()([uTo[TYPE_IDX], CITY_TYPE]);

    signal toTypeCorrect <== Mux1()([case1, case2], capturingCapital);

    out <== AND()(fromTypeCorrect, toTypeCorrect);
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
