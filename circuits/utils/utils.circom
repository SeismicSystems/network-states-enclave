pragma circom 2.1.1;

include "../node_modules/circomlib/circuits/gates.circom";

/*
 * Checks if every pair in the input list satisfies equality. 
 */
template BatchIsEqual(SIZE) {
    signal input a[SIZE][2];

    signal output out;

    signal eqs[SIZE];
    signal accumulator[SIZE];
    for (var i = 0; i < SIZE; i++) {
        eqs[i] <== IsEqual()([a[i][0], a[i][1]]);
        if (i == 0) {
            accumulator[i] <== eqs[i];
        }
        else {
            accumulator[i] <== AND()(accumulator[i - 1], eqs[i]);
        }
    }
    
    out <== accumulator[SIZE - 1];
}

/*
 * Checks whether every element in the input list is equal to zero. 
 */
template BatchIsZero(SIZE) {
    signal input a[SIZE];

    signal output out;

    signal zeros[SIZE];
    signal accumulator[SIZE];
    for (var i = 0; i < SIZE; i++) {
        zeros[i] <== IsZero()(a[i]);
        if (i == 0) {
            accumulator[i] <== zeros[i];
        }
        else {
            accumulator[i] <== AND()(accumulator[i - 1], zeros[i]);
        }
    }
    
    out <== accumulator[SIZE - 1];
}


/*
 * Checks whether a pair is present in an array of pairs.
 */
template PairArrayContains(N) {
    signal input arr[N][2];
    signal input pair[2];
    signal output out;

    signal accumulator[N];
    accumulator[0] <== ArrayEqual(2)(arr[0], pair);
    for (var i = 1; i < N; i++) {
        accumulator[i] <== OR()(accumulator[i - 1], 
            BatchIsEqual(2)([arr[i][0], pair[0]], [arr[i][1], pair[1]]));
    }

    out <== accumulator[N - 1];
}
