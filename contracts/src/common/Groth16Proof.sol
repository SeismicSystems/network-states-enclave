// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

struct Groth16Proof {
    uint256[2] a;
    uint256[2][2] b;
    uint256[2] c;
}
