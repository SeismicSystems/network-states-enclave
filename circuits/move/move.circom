pragma circom 2.1.1;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../utils/utils.circom";

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

    // Assert the new state leaves are correctly computed
    signal circuitHFrom <== Poseidon(N_TILE_ATTRS)(uFrom);
    signal circuitHTo <== Poseidon(N_TILE_ATTRS)(uTo);
    hUFrom === circuitHFrom;
    hUTo === circuitHTo;

    // Assert the nullifiers for old tile states are correctly computed
    signal circuitRhoFrom <== Poseidon(1)([tFrom[KEY_IDX]]);
    signal circuitRhoTo <== Poseidon(1)([tTo[KEY_IDX]]);
    rhoFrom === circuitRhoFrom;
    rhoTo === circuitRhoTo;

    // Assert the rules of the game are followed
    tTo[ROW_IDX] === uTo[ROW_IDX];
    tFrom[ROW_IDX] === uFrom[ROW_IDX];

    signal step[2] <== [tTo[ROW_IDX] - tFrom[ROW_IDX], 
        tTo[COL_IDX] - tFrom[COL_IDX]];
    signal stepValid <== PairArrayContains(N_VALID_MOVES)(VALID_MOVES, step);
    stepValid === 1;

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
