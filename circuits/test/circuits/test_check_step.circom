pragma circom 2.1.1;

include "../../move/move.func.circom";

component main = CheckStep(
    [[0, 1], [0, -1], [1, 0], [-1, 0]], 
    4, 7, 0, 1, 6, 4);
