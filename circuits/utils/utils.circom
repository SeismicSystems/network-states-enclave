pragma circom 2.1.1;

include "../node_modules/circomlib/circuits/gates.circom";

/*
 * Checks equality for two input arrays of length N.  
 */
template ArrayEqual(N) {
    signal input arr1[N];
    signal input arr2[N];
    signal output out;

    signal accumulator[N];
    accumulator[0] <== IsEqual()([arr1[0], arr2[0]]);
    for (var i = 1; i < N; i++)
        accumulator[i] <== 
            AND()(accumulator[i - 1], IsEqual()([arr1[i], arr2[i]]));
    out <== accumulator[N-1];
}

/*
 * Checks whether a pair array contains a given pair. A pair is represented as 
 * an array of length 2. Equivalently, checks whether a pair is present in an 
 * array. Implementation inspired by ZKHunt. 
 * Reference: https://github.com/FlynnSC/zk-hunt/blob/40455327102618ba4f8f629e1ae094a5b072a3c1/packages/circuits/src/utils/isEqualToAny.circom
 */
template PairArrayContains(N) {
    signal input arr[N][2];
    signal input pair[2];
    signal output out;

    signal accumulator[N];
    accumulator[0] <== ArrayEqual(2)(arr[0], pair);
    for (var i = 1; i < N; i++) 
        accumulator[i] <== 
            OR()(accumulator[i - 1], ArrayEqual(2)(arr[i], pair));

    out <== accumulator[N - 1];
}
