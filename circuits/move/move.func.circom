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
 * the old states they are replacing and 2) the movement is one tile in one of
 * the cardinal directions.  
 */
template CheckStep(VALID_MOVES, N_VALID_MOVES, N_TL_ATRS, ROW_IDX, COL_IDX) {
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
    
    out <== AND()(positionsConsistent, stepValid);
}

/*
 * Must preserve resource management logic- what happens when armies expand to
 * unowned or enemy territories. 
 */
template CheckRsrc(N_TL_ATRS, RSRC_IDX, PUBX_IDX, PUBY_IDX, UNOWNED, SYS_BITS) {
    signal input tFrom[N_TL_ATRS];
    signal input tTo[N_TL_ATRS];
    signal input uFrom[N_TL_ATRS];
    signal input uTo[N_TL_ATRS];

    signal output out;

    // Not allowed to move all troops off of tile
    signal movedAllTroops <== IsZero()(uFrom[RSRC_IDX]);

    // Make sure resource management can't be broken via overflow
    signal overflowFrom <== GreaterEqThan(SYS_BITS)([uFrom[RSRC_IDX], 
        tFrom[RSRC_IDX]]);
    signal overflowTo <== GreaterEqThan(SYS_BITS)([uTo[RSRC_IDX], 
        tFrom[RSRC_IDX] + tTo[RSRC_IDX]]);

    // Hash public keys so we can compare single field elements
    signal tFromPub <== Poseidon(2)([tFrom[PUBX_IDX], tFrom[PUBY_IDX]]);
    signal tToPub <== Poseidon(2)([tTo[PUBX_IDX], tTo[PUBY_IDX]]);
    signal uFromPub <== Poseidon(2)([uFrom[PUBX_IDX], uFrom[PUBY_IDX]]);
    signal uToPub <== Poseidon(2)([uTo[PUBX_IDX], uTo[PUBY_IDX]]);

    // Properties we need to know regarding `to` tile relative to `from` tile
    signal ontoSelf <== IsEqual()([tFromPub, tToPub]);
    signal ontoUnowned <== IsEqual()([tToPub, UNOWNED]);
    signal ontoSelfOrUnowned <== OR()(ontoSelf, ontoUnowned);
    signal ontoEnemy <== NOT()(ontoSelfOrUnowned);
    signal ontoMoreOrEq <== GreaterEqThan(SYS_BITS)([tTo[RSRC_IDX], 
        tFrom[RSRC_IDX] - uFrom[RSRC_IDX]]);
    signal ontoLess <== NOT()(ontoMoreOrEq);

    // From tile must stay player's, player cannot be UNOWNED
    signal fromOwnership <== IsEqual()([tFromPub, uFromPub]);
    signal fromOwnershipWrong <== NOT()(fromOwnership);
    signal playerUnowned <== IsEqual()([tFromPub, UNOWNED]);
    signal ownershipLogic <== OR()(fromOwnershipWrong, playerUnowned);

    // Moving onto a non-enemy tile (self or unowned)
    signal case1Logic <== BatchIsEqual(2)([
        [tFrom[RSRC_IDX] + tTo[RSRC_IDX], uFrom[RSRC_IDX] + uTo[RSRC_IDX]],
        [uToPub, uFromPub]
    ]);
    signal case1LogicWrong <== NOT()(case1Logic);
    signal case1 <== case1LogicWrong * ontoSelfOrUnowned;

    // Moving onto enemy tile that has more or eq resource vs what's being sent
    signal case2Logic <== BatchIsEqual(2)([
        [tFrom[RSRC_IDX] - uFrom[RSRC_IDX], tTo[RSRC_IDX] - uTo[RSRC_IDX]],
        [uToPub, tToPub]
    ]);
    signal case2LogicWrong <== NOT()(case2Logic);
    signal case2Selector <== AND()(ontoEnemy, ontoMoreOrEq);
    signal case2 <== case2LogicWrong * case2Selector;

    // Moving onto enemy tile that has less resource vs what's being sent
    signal case3Logic <== BatchIsEqual(2)([
        [tFrom[RSRC_IDX] - uFrom[RSRC_IDX], tTo[RSRC_IDX] + uTo[RSRC_IDX]],
        [uToPub, uFromPub]]);
    signal case3LogicWrong <== NOT()(case3Logic);
    signal case3Selector <== AND()(ontoEnemy, ontoLess);
    signal case3 <== case3LogicWrong * case3Selector;

    out <== BatchIsZero(7)([movedAllTroops, overflowFrom, overflowTo, 
        ownershipLogic, case1, case2, case3]);
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

    var N_TL_ATRS = 6;
    var PUBX_IDX = 0;
    var PUBY_IDX = 1;
    var ROW_IDX = 2;
    var COL_IDX = 3;
    var RSRC_IDX = 4;
    var KEY_IDX = 5;

    var UNOWNED = 14744269619966411208579211824598458697587494354926760081771325075741142829156;
    var SYS_BITS = 252;

    signal input root;
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
    signal input privKeyHash;

    signal leavesCorrect <== CheckLeaves(N_TL_ATRS, PUBX_IDX, PUBY_IDX)(uFrom, uTo, hUFrom, 
        hUTo, privKeyHash);
    leavesCorrect === 1;

    signal nullifiersCorrect <== CheckNullifiers()(tFrom[KEY_IDX], 
        tTo[KEY_IDX], rhoFrom, rhoTo);
    nullifiersCorrect === 1;

    signal stepCorrect <== CheckStep(VALID_MOVES, N_VALID_MOVES, N_TL_ATRS, 
        ROW_IDX, COL_IDX)(tFrom, tTo, uFrom, uTo);
    stepCorrect === 1;

    signal resourcesCorrect <== CheckRsrc(N_TL_ATRS, RSRC_IDX, PUBX_IDX, 
        PUBY_IDX, UNOWNED, SYS_BITS)(tFrom, tTo, uFrom, uTo);

    signal merkleProofCorrect <== CheckMerkleInclusion(N_TL_ATRS,
        MERKLE_TREE_DEPTH)(root, tFrom, tFromPathIndices, tFromPathElements,
        tTo, tToPathIndices, tToPathElements);
    merkleProofCorrect === 1;
}
