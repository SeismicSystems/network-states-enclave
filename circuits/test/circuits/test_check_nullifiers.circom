pragma circom 2.1.1;

include "../../move/move.func.circom";

component main { public [ keyFrom, keyTo, rhoFrom, rhoTo ] } = CheckNullifiers();
