pragma circom 2.0.3;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/*
 * Prove valid state transitions for the `from` and `to` tiles. Also proves 
 * the inclusion of the old states in a merkle root. Assumes tiles are 
 * represented as [symbol, row, col, resource, key]. 
 */
template Move() {
    log("-- BEGIN CIRCUIT LOGS");
    var N_TILE_ATTRS = 5;
    var RESOURCE_IDX = 3;
    var KEY_IDX = 4;

    signal input h_u_from;
    signal input h_u_to;
    signal input rho_from;
    signal input rho_to;

    signal input t_from[N_TILE_ATTRS];
    signal input t_to[N_TILE_ATTRS];
    signal input u_from[N_TILE_ATTRS];
    signal input u_to[N_TILE_ATTRS];

    // Assert the new state leaves are correctly computed
    signal circuit_h_u_from <== Poseidon(N_TILE_ATTRS)(u_from);
    signal circuit_h_u_to <== Poseidon(N_TILE_ATTRS)(u_to);
    h_u_from === circuit_h_u_from;
    h_u_to === circuit_h_u_to;

    // Assert the nullifiers for old tile states are correctly computed
    signal circuit_rho_from <== Poseidon(1)([t_from[KEY_IDX]]);
    signal circuit_rho_to <== Poseidon(1)([t_to[KEY_IDX]]);

    // Assert the rules of the game are followed
    signal moved_all_troops <== IsZero()(u_from[RESOURCE_IDX]);
    moved_all_troops === 0;

    log("-- END CIRCUIT LOGS");
}

component main { public [ h_u_from, h_u_to, rho_from, rho_to ] } = Move();
