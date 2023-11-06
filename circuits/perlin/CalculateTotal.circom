/*
 * Adapted from darkforest-v0.6's implementation of perlin noise. All
 * credit is due to the Darkforest team for the original source.
 * Original source: https://github.com/darkforest-eth/darkforest-v0.6. 
 * Only change is import paths.
 */

pragma circom 2.0.3;

template CalculateTotal(n) {
    signal input in[n];
    signal output out;

    signal sums[n];

    sums[0] <== in[0];

    for (var i = 1; i < n; i++) {
        sums[i] <== sums[i-1] + in[i];
    }

    out <== sums[n-1];
}
