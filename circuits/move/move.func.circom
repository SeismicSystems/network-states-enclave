pragma circom 2.1.1;

include "../node_modules/maci-circuits/node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/maci-circuits/node_modules/circomlib/circuits/comparators.circom";
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
 * private key corresponds to the tile's public keys.
 */
template CheckLeaves(N_TL_ATRS, PUBX_IDX, PUBY_IDX) {
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input hUFrom;
    signal input hUTo;

    signal input privKeyHash;

    signal output out;

    // Whether player 'owns' the 'from' tile
    component bjj = BabyPbk();
    bjj.in <== privKeyHash;

    signal circuitHFrom <== Poseidon(N_TL_ATRS)(uFrom);
    signal circuitHTo <== Poseidon(N_TL_ATRS)(uTo);

    out <== BatchIsEqual(4)([
        [uFrom[PUBX_IDX], bjj.Ax],
        [uFrom[PUBY_IDX], bjj.Ay],
        [hUFrom, circuitHFrom], 
        [hUTo, circuitHTo]]);
}

/*
 * A valid step entails 1) new tile states must have the same coordinates as 
 * the old states they are replacing, 2) the movement is one tile in one of
 * the cardinal directions, and 3) the to tile is not a hill tile.
 */
template CheckStep(VALID_MOVES, N_VALID_MOVES, N_TL_ATRS, ROW_IDX, COL_IDX, 
    TYPE_IDX, HILL_ID) {
    signal input tFrom[N_TL_ATRS];
    signal input tTo[N_TL_ATRS];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];

    signal output out;

    signal positionsConsistent <== BatchIsEqual(4)([[tFrom[ROW_IDX], 
        uFrom[ROW_IDX]], [tFrom[COL_IDX], uFrom[COL_IDX]], [tTo[ROW_IDX], 
        uTo[ROW_IDX]], [tTo[COL_IDX], uTo[COL_IDX]]]);

    signal step[2] <== [tTo[ROW_IDX] - tFrom[ROW_IDX], 
        tTo[COL_IDX] - tFrom[COL_IDX]];
    signal stepValid <== PairArrayContains(N_VALID_MOVES)(VALID_MOVES, step);

    signal ontoHill <== IsEqual()([tTo[TYPE_IDX], HILL_ID]);
    signal notOntoHill <== NOT()(ontoHill);
    
    out <== AND()((AND()(positionsConsistent, stepValid)), notOntoHill);
}

/*
 * Must preserve resource management logic- what happens when armies expand to
 * unowned or enemy territories. 
 */
template CheckRsrc(N_TL_ATRS, RSRC_IDX, PUBX_IDX, PUBY_IDX, TRP_UPD_IDX, 
    UNOWNED, SYS_BITS) {
    signal input currentTroopInterval;

    signal input tFrom[N_TL_ATRS];
    signal input tTo[N_TL_ATRS];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];
    signal input fromUpdatedTroops;
    signal input toUpdatedTroops;

    signal output out;

    // Hash public keys so we can compare single field elements
    signal tFromPub <== Poseidon(2)([tFrom[PUBX_IDX], tFrom[PUBY_IDX]]);
    signal tToPub <== Poseidon(2)([tTo[PUBX_IDX], tTo[PUBY_IDX]]);
    signal uFromPub <== Poseidon(2)([uFrom[PUBX_IDX], uFrom[PUBY_IDX]]);
    signal uToPub <== Poseidon(2)([uTo[PUBX_IDX], uTo[PUBY_IDX]]);

    // Properties we need to know regarding `to` tile relative to `from` tile
    signal ontoSelf <== IsEqual()([tFromPub, tToPub]);
    signal ontoUnowned <== IsEqual()([tToPub, UNOWNED]);
    signal ontoSelfOrEnemy <== NOT()(ontoUnowned);
    signal ontoSelfOrUnowned <== OR()(ontoSelf, ontoUnowned);
    signal ontoEnemy <== NOT()(ontoSelfOrUnowned);

    // Not allowed to move all troops off of tile
    signal movedAllTroops <== IsZero()(uFrom[RSRC_IDX]);

    signal troopUpdateCorrect <== CheckTroopUpdates()(currentTroopInterval, 
        tFrom[RSRC_IDX], tFrom[TRP_UPD_IDX], tTo[RSRC_IDX], tTo[TRP_UPD_IDX], 
        uFrom[TRP_UPD_IDX], uTo[TRP_UPD_IDX], ontoSelfOrEnemy, 
        fromUpdatedTroops, toUpdatedTroops);
    signal troopUpdateIncorrect <== NOT()(troopUpdateCorrect);

    // Make sure resource management can't be broken via overflow
    signal overflowFrom <== GreaterEqThan(SYS_BITS)([uFrom[RSRC_IDX], 
        fromUpdatedTroops]);
    signal overflowTo <== GreaterEqThan(SYS_BITS)([uTo[RSRC_IDX], 
        fromUpdatedTroops + toUpdatedTroops]);

    signal ontoMoreOrEq <== GreaterEqThan(SYS_BITS)([toUpdatedTroops, 
        fromUpdatedTroops - uFrom[RSRC_IDX]]);
    signal ontoLess <== NOT()(ontoMoreOrEq);

    // From tile must remain player's after move
    signal fromOwnership <== IsEqual()([tFromPub, uFromPub]);
    signal fromOwnershipWrong <== NOT()(fromOwnership);

    // Moving onto a non-enemy tile (self or unowned)
    signal case1Logic <== BatchIsEqual(2)([
        [fromUpdatedTroops + toUpdatedTroops, uFrom[RSRC_IDX] + uTo[RSRC_IDX]],
        [uToPub, uFromPub]
    ]);
    signal case1LogicWrong <== NOT()(case1Logic);
    signal case1 <== case1LogicWrong * ontoSelfOrUnowned;

    // Moving onto enemy tile that has more or eq resource vs what's being sent
    signal case2Logic <== BatchIsEqual(2)([
        [fromUpdatedTroops - uFrom[RSRC_IDX], toUpdatedTroops - uTo[RSRC_IDX]],
        [uToPub, tToPub]
    ]);
    signal case2LogicWrong <== NOT()(case2Logic);
    signal case2Selector <== AND()(ontoEnemy, ontoMoreOrEq);
    signal case2 <== case2LogicWrong * case2Selector;

    // Moving onto enemy tile that has less resource vs what's being sent
    signal case3Logic <== BatchIsEqual(2)([
        [fromUpdatedTroops - uFrom[RSRC_IDX], toUpdatedTroops + uTo[RSRC_IDX]],
        [uToPub, uFromPub]]);
    signal case3LogicWrong <== NOT()(case3Logic);
    signal case3Selector <== AND()(ontoEnemy, ontoLess);
    signal case3 <== case3LogicWrong * case3Selector;

    out <== BatchIsZero(8)([movedAllTroops, troopUpdateIncorrect, overflowFrom, 
        overflowTo, fromOwnershipWrong, case1, case2, case3]);
}

/*
 * Asserts that the attacker's and defender's resources prior to moving reflect
 * any troop updates that should have occurred.
 */
template CheckTroopUpdates() {
    signal input currentTroopInterval;

    signal input tFromTroops;
    signal input tFromLatestUpdate;
    signal input tToTroops;
    signal input tToLatestUpdate;
    signal input uFromLatestUpdate;
    signal input uToLatestUpdate;
    signal input ontoSelfOrEnemy;
    signal input fromUpdatedTroops;
    signal input toUpdatedTroops;

    signal output out;

    // Make sure updated troop counts are computed correctly
    signal circuitFromUpdatedTroops <== tFromTroops + currentTroopInterval 
        - tFromLatestUpdate;
    signal circuitToUpdatedTroops <== (tToTroops + currentTroopInterval
        - tToLatestUpdate) * ontoSelfOrEnemy;
    signal troopRsrcCorrect <== BatchIsEqual(2)([
        [circuitFromUpdatedTroops, fromUpdatedTroops],
        [circuitToUpdatedTroops, toUpdatedTroops]]);

    // Troop updates should be accounted for in new tile states
    signal troopsCounted <== BatchIsEqual(2)([
        [currentTroopInterval, uFromLatestUpdate],
        [currentTroopInterval, uToLatestUpdate]]);

    out <== AND()(troopRsrcCorrect, troopsCounted);
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
    var PUBX_IDX = 0;
    var PUBY_IDX = 1;
    var ROW_IDX = 2;
    var COL_IDX = 3;
    var RSRC_IDX = 4;
    var KEY_IDX = 5;
    var TRP_UPD_IDX = 6;
    var TYPE_IDX = 7;

    // Hash of UNOWNED_PLAYER's public keys, used to look for unowned tiles
    var UNOWNED = 7423237065226347324353380772367382631490014989348495481811164164159255474657;

    // Id's used to check for water and hill tiles
    var WATER_ID = 1;
    var HILL_ID = 2;

    var SYS_BITS = 252;

    signal input root;
    signal input currentTroopInterval;
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

    signal leavesCorrect <== CheckLeaves(N_TL_ATRS, PUBX_IDX, PUBY_IDX)(uFrom, 
        uTo, hUFrom, hUTo, privKeyHash);
    leavesCorrect === 1;

    signal nullifiersCorrect <== CheckNullifiers()(tFrom[KEY_IDX], 
        tTo[KEY_IDX], rhoFrom, rhoTo);
    nullifiersCorrect === 1;

    signal stepCorrect <== CheckStep(VALID_MOVES, N_VALID_MOVES, N_TL_ATRS, 
        ROW_IDX, COL_IDX, TYPE_IDX, HILL_ID)(tFrom, tTo, uFrom, uTo);
    stepCorrect === 1;

    signal resourcesCorrect <== CheckRsrc(N_TL_ATRS, RSRC_IDX, PUBX_IDX, 
        PUBY_IDX, TRP_UPD_IDX, UNOWNED, SYS_BITS)(currentTroopInterval, tFrom, 
        tTo, uFrom, uTo, fromUpdatedTroops, toUpdatedTroops);
    resourcesCorrect === 1;

    signal merkleProofCorrect <== CheckMerkleInclusion(N_TL_ATRS,
        MERKLE_TREE_DEPTH)(root, tFrom, tFromPathIndices, tFromPathElements,
        tTo, tToPathIndices, tToPathElements);
    merkleProofCorrect === 1;
}
