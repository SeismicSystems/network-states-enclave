pragma circom 2.1.1;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../utils/utils.circom";

template BatchIsEqual(SIZE) {
    signal input a[SIZE][2];

    signal output out;

    signal eqs[SIZE];
    signal ands[SIZE];
    for (var i = 0; i < SIZE; i++) {
        eqs[i] <== IsEqual()([a[i][0], a[i][1]]);
        if (i == 0) {
            ands[i] <== eqs[i];
        }
        else {
            ands[i] <== AND()(ands[i - 1], eqs[i]);
        }
    }
    
    out <== ands[SIZE - 1];
}

template BatchIsZero(SIZE) {
    signal input a[SIZE];

    signal output out;

    signal zeros[SIZE];
    signal ands[SIZE];
    for (var i = 0; i < SIZE; i++) {
        zeros[i] <== IsZero()(a[i]);
        if (i == 0) {
            ands[i] <== zeros[i];
        }
        else {
            ands[i] <== AND()(ands[i - 1], zeros[i]);
        }
    }
    
    out <== ands[SIZE - 1];
}

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

template CheckLeaves(N_TILE_ATTRS) {
    signal input uFrom[N_TILE_ATTRS];
    signal input uTo[N_TILE_ATTRS];
    signal input hUFrom;
    signal input hUTo;

    signal output out;

    signal circuitHFrom <== Poseidon(N_TILE_ATTRS)(uFrom);
    signal circuitHTo <== Poseidon(N_TILE_ATTRS)(uTo);

    out <== BatchIsEqual(2)([[hUFrom, circuitHFrom], [hUTo, circuitHTo]]);
}

template CheckStep(VALID_MOVES, N_VALID_MOVES, N_TILE_ATTRS, ROW_IDX, COL_IDX) {
    signal input tFrom[N_TILE_ATTRS];
    signal input tTo[N_TILE_ATTRS];
    signal input uFrom[N_TILE_ATTRS];
    signal input uTo[N_TILE_ATTRS];

    signal output out;

    signal positionsConsistent <== BatchIsEqual(4)([[tFrom[ROW_IDX], 
        uFrom[ROW_IDX]], [tFrom[COL_IDX], uFrom[COL_IDX]], [tTo[ROW_IDX], 
        uTo[ROW_IDX]], [tTo[COL_IDX], uTo[COL_IDX]]]);

    signal step[2] <== [tTo[ROW_IDX] - tFrom[ROW_IDX], 
        tTo[COL_IDX] - tFrom[COL_IDX]];
    signal stepValid <== PairArrayContains(N_VALID_MOVES)(VALID_MOVES, step);
    
    out <== AND()(positionsConsistent, stepValid);
}

template CheckResources(N_TILE_ATTRS, RSRC_IDX, SYMB_IDX, UNOWNED_SYMB, PRF_SYS_BITS) {
    signal input tFrom[N_TILE_ATTRS];
    signal input tTo[N_TILE_ATTRS];
    signal input uFrom[N_TILE_ATTRS];
    signal input uTo[N_TILE_ATTRS];

    signal output out;

    // Not allowed to move all troops off of tile
    signal movedAllTroops <== IsZero()(uFrom[RSRC_IDX]);

    // Make sure resource management can't be broken via overflow
    signal overflowFrom <== GreaterEqThan(PRF_SYS_BITS)([uFrom[RSRC_IDX], 
        tFrom[RSRC_IDX]]);
    signal overflowTo <== GreaterEqThan(PRF_SYS_BITS)([uTo[RSRC_IDX], 
        tFrom[RSRC_IDX] + tTo[RSRC_IDX]]);

    // Properties we need to know regarding `to` tile relative to `from` tile
    signal ontoSelf <== IsEqual()([tFrom[SYMB_IDX], tTo[SYMB_IDX]]);
    signal ontoUnowned <== IsEqual()([tTo[SYMB_IDX], UNOWNED_SYMB]);
    signal ontoSelfOrUnowned <== OR()(ontoSelf, ontoUnowned);
    signal ontoEnemy <== NOT()(ontoSelfOrUnowned);
    signal ontoMoreOrEq <== GreaterEqThan(PRF_SYS_BITS)([tTo[RSRC_IDX], 
        uFrom[RSRC_IDX] - tFrom[RSRC_IDX]]);
    signal ontoLess <== NOT()(ontoMoreOrEq);

    // Moving onto a non-enemy tile (self or unowned)
    signal case1Logic <== BatchIsEqual(3)([[tFrom[RSRC_IDX] + tTo[RSRC_IDX], 
        uFrom[RSRC_IDX] + uTo[RSRC_IDX]], [tFrom[SYMB_IDX], uFrom[SYMB_IDX]],
        [tTo[SYMB_IDX], uTo[SYMB_IDX]]]);
    signal case1LogicWrong <== NOT()(case1Logic);
    signal case1 <== case1LogicWrong * ontoSelfOrUnowned;

    // Moving onto enemy tile that has more or eq resource vs what's being sent
    signal case2Logic <== BatchIsEqual(3)([[tFrom[RSRC_IDX] - uFrom[RSRC_IDX], 
        tTo[RSRC_IDX] - uTo[RSRC_IDX]], [tFrom[SYMB_IDX], uFrom[SYMB_IDX]],
        [tTo[SYMB_IDX], uTo[SYMB_IDX]]]);
    signal case2LogicWrong <== NOT()(case2Logic);
    signal case2Selector <== AND()(ontoEnemy, ontoMoreOrEq);
    signal case2 <== case2LogicWrong * case2Selector;

    // Moving onto enemy tile that has less resource vs what's being sent
    signal case3Logic <== BatchIsEqual(3)([[tFrom[RSRC_IDX] - uFrom[RSRC_IDX], 
        tTo[RSRC_IDX] + uTo[RSRC_IDX]], [tFrom[SYMB_IDX], uFrom[SYMB_IDX]],
        [tFrom[SYMB_IDX], uTo[SYMB_IDX]]]);
    signal case3LogicWrong <== NOT()(case3Logic);
    signal case3Selector <== AND()(ontoEnemy, ontoLess);
    signal case3 <== case3LogicWrong * case3Selector;

    out <== BatchIsZero(6)([movedAllTroops, overflowFrom, overflowTo, case1,
        case2, case3]);
}

/*
 * Prove valid state transitions for the `from` and `to` tiles. Also proves 
 * the inclusion of the old states in a merkle root. Assumes tiles are 
 * represented as [symbol, row, col, resource, key]. 
 */
template Move() {
    log("-- BEGIN CIRCUIT LOGS");
    var N_VALID_MOVES = 4;
    var VALID_MOVES[N_VALID_MOVES][2] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    var N_TILE_ATTRS = 5;
    var SYMB_IDX = 0;
    var ROW_IDX = 1;
    var COL_IDX = 2;
    var RSRC_IDX = 3;
    var KEY_IDX = 4;

    var UNOWNED_SYMB = 95;
    var PRF_SYS_BITS = 252;

    signal input hUFrom;
    signal input hUTo;
    signal input rhoFrom;
    signal input rhoTo;

    signal input tFrom[N_TILE_ATTRS];
    signal input tTo[N_TILE_ATTRS];
    signal input uFrom[N_TILE_ATTRS];
    signal input uTo[N_TILE_ATTRS];

    signal leavesCorrect <== CheckLeaves(N_TILE_ATTRS)(uFrom, uTo, hUFrom, 
        hUTo);
    leavesCorrect === 1;

    signal nullifiersCorrect <== CheckNullifiers()(tFrom[KEY_IDX], 
        tTo[KEY_IDX], rhoFrom, rhoTo);
    nullifiersCorrect === 1;

    signal stepCorrect <== CheckStep(VALID_MOVES, N_VALID_MOVES, N_TILE_ATTRS, 
        ROW_IDX, COL_IDX)(tFrom, tTo, uFrom, uTo);
    stepCorrect === 1;

    signal resourcesCorrect <== CheckResources(N_TILE_ATTRS, RSRC_IDX, SYMB_IDX,
        UNOWNED_SYMB, PRF_SYS_BITS)(tFrom, tTo, uFrom, uTo);

    log("-- END CIRCUIT LOGS");
}

component main { public [ hUFrom, hUTo, rhoFrom, rhoTo ] } = Move();
