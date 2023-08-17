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
            ands[i] <== AND()(ands[i-1], eqs[i]);
        }
    }
    
    out <== ands[SIZE - 1];
}

template CheckNullifierCompute() {
    signal input keyFrom;
    signal input keyTo;
    signal input rhoFrom;
    signal input rhoTo;

    signal output out;

    signal circuitRhoFrom <== Poseidon(1)([keyFrom]);
    signal circuitRhoTo <== Poseidon(1)([keyTo]);

    out <== BatchIsEqual(2)([[rhoFrom, circuitRhoFrom], [rhoTo, circuitRhoTo]]);
}

template CheckLeafCompute(N_TILE_ATTRS) {
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

    var PRF_SYS_BITS = 252;

    signal input hUFrom;
    signal input hUTo;
    signal input rhoFrom;
    signal input rhoTo;

    signal input tFrom[N_TILE_ATTRS];
    signal input tTo[N_TILE_ATTRS];
    signal input uFrom[N_TILE_ATTRS];
    signal input uTo[N_TILE_ATTRS];

    signal leavesCorrect <== CheckLeafCompute(N_TILE_ATTRS)(uFrom, uTo, hUFrom, 
        hUTo);
    leavesCorrect === 1;

    signal nullifiersCorrect <== CheckNullifierCompute()(tFrom[KEY_IDX], 
        tTo[KEY_IDX], rhoFrom, rhoTo);
    nullifiersCorrect === 1;

    // Assert the rules of the game are followed
    signal stepCorrect <== CheckStep(VALID_MOVES, N_VALID_MOVES, N_TILE_ATTRS, 
        ROW_IDX, COL_IDX)(tFrom, tTo, uFrom, uTo);
    stepCorrect === 1;

    signal movedAllTroops <== IsZero()(uFrom[RSRC_IDX]);
    movedAllTroops === 0;

    signal resourcesOverflowed <== GreaterEqThan(PRF_SYS_BITS)([uFrom[RSRC_IDX], 
        tFrom[RSRC_IDX] + tTo[RSRC_IDX]]);
    resourcesOverflowed === 0;
    uFrom[RSRC_IDX] + uTo[RSRC_IDX] === tFrom[RSRC_IDX] + tTo[RSRC_IDX];
    uFrom[SYMB_IDX] === tFrom[SYMB_IDX];
    uTo[SYMB_IDX] === tFrom[SYMB_IDX];

    log("-- END CIRCUIT LOGS");
}

component main { public [ hUFrom, hUTo, rhoFrom, rhoTo ] } = Move();
