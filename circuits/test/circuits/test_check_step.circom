pragma circom 2.1.1;

include "../../move/move.func.circom";

component main = CheckStep(
    [[0, 1], [0, -1], [1, 0], [-1, 0]], 
    4, 8, 0, 1, 7, 4);
