pragma circom 2.1.1;

include "../node_modules/maci-circuits/node_modules/circomlib/circuits/poseidon.circom";
include "../perlin/perlin.circom";

template CheckVirtType(N_TL_ATRS, ROW_IDX, COL_IDX, TYPE_IDX, PERLIN_KEY, 
    PERLIN_SCALE) {

    signal input virt[N_TL_ATRS];

    signal output out;

    // Perlin noise at location (r, c)
    signal perlin <== MultiScalePerlin()(
        [virt[ROW_IDX], virt[COL_IDX]], PERLIN_KEY, PERLIN_SCALE, 0, 0);

    out <== 1;
}

/*
 * Asserts that a virtual tile is computed faithfully with respect to committed
 * randomness. Also constrains a public signal of a location blinded by salt
 * chosen by the client to constrain location in the client-side ZKPs (spawn and
 * move).
 */
template Virtual() {
    var N_TL_ATRS = 7;
    var ROW_IDX = 0;
    var COL_IDX = 1;
    var KEY_IDX = 3;
    var TYPE_IDX = 6;

    // darkforest-v0.6 constants for MultiScalePerlin()
    var PERLIN_KEY = 2;
    var PERLIN_SCALE = 2;

    signal input hRand;
    signal input hVirt;

    signal input rand;
    signal input virt[N_TL_ATRS];

    signal circuitHRand <== Poseidon(1)([rand]);
    signal hRCorrect <== IsEqual()([circuitHRand, hRand]);
    hRCorrect === 1;

    signal circuitHVirt <== Poseidon(N_TL_ATRS)(virt);
    signal hVirtCorrect <== IsEqual()([circuitHVirt, hVirt]);
    hVirtCorrect === 1;

    signal circuitKey <== Poseidon(3)([rand, virt[ROW_IDX], virt[COL_IDX]]);
    signal keyCorrect <== IsEqual()([circuitKey, virt[KEY_IDX]]);
    keyCorrect === 1;

    signal virtTypeCorrect <== CheckVirtType(N_TL_ATRS, ROW_IDX, COL_IDX,
        TYPE_IDX, PERLIN_KEY, PERLIN_SCALE)(virt);
    virtTypeCorrect === 1;
}
