pragma circom 2.1.1;

include "../node_modules/maci-circuits/node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/maci-circuits/node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/maci-circuits/node_modules/circomlib/circuits/mux3.circom";
include "../utils/utils.circom";
include "../perlin/perlin.circom";

template CheckVirtType(N_TL_ATRS, ROW_IDX, COL_IDX, RSRC_IDX, TYPE_IDX, 
    PERLIN_KEY, PERLIN_SCALE, PERLIN_SYS_BITS, PERLIN_THRESHOLD_BONUS_TROOPS,
    PERLIN_THRESHOLD_HILL, PERLIN_THRESHOLD_WATER, BARE_TYPE, WATER_TYPE, 
    HILL_TYPE) {

    signal input virt[N_TL_ATRS];

    signal output out;

    // Perlin noise at location (r, c)
    signal perlin <== MultiScalePerlin()(
        [virt[ROW_IDX], virt[COL_IDX]], PERLIN_KEY, PERLIN_SCALE, 0, 0);

    signal isBare <== IsEqual()([virt[TYPE_IDX], BARE_TYPE]);
    signal isWater <== IsEqual()([virt[TYPE_IDX], WATER_TYPE]);
    signal isHill <== IsEqual()([virt[TYPE_IDX], HILL_TYPE]);

    signal isPlusFive <== IsEqual()([virt[RSRC_IDX], 5]);
    signal isBonus <== AND()(isBare, isPlusFive);

    signal geqBonusTroopsThreshold <== GreaterEqThan(PERLIN_SYS_BITS)([perlin,
        PERLIN_THRESHOLD_BONUS_TROOPS]);
    signal geqHillThreshold <== GreaterEqThan(PERLIN_SYS_BITS)([perlin, 
        PERLIN_THRESHOLD_HILL]);
    signal geqWaterThreshold <== GreaterEqThan(PERLIN_SYS_BITS)([perlin, 
        PERLIN_THRESHOLD_WATER]);

    out <== Mux3()(
        [isBare, isWater, isHill, isHill, isBonus, isBonus, isBonus, isBonus], 
        [geqWaterThreshold, geqHillThreshold, geqBonusTroopsThreshold]);
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
    var RSRC_IDX = 2;
    var KEY_IDX = 3;
    var TYPE_IDX = 6;

    // darkforest-v0.6 constants for MultiScalePerlin()
    var PERLIN_KEY = 2;
    var PERLIN_SCALE = 2;

    // Number of bits used in range checks to constrain tile type from noise
    var PERLIN_SYS_BITS = 5;

    // Threshold values for hill and water type
    var PERLIN_THRESHOLD_BONUS_TROOPS = 19;
    var PERLIN_THRESHOLD_HILL = 18;
    var PERLIN_THRESHOLD_WATER = 17;

    // Id's used to check tile type
    var BARE_TYPE = 0;
    var CITY_TYPE = 1;
    var WATER_TYPE = 2;
    var HILL_TYPE = 3;

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
        RSRC_IDX, TYPE_IDX, PERLIN_KEY, PERLIN_SCALE, PERLIN_SYS_BITS, 
        PERLIN_THRESHOLD_BONUS_TROOPS, PERLIN_THRESHOLD_HILL, 
        PERLIN_THRESHOLD_WATER, BARE_TYPE, WATER_TYPE, HILL_TYPE)(virt);
    virtTypeCorrect === 1;
}
