// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

struct SpawnInputs {
    bool canSpawn;
    uint24 spawnCityId;
    uint256 commitBlockHash;
    uint256 hPrevTile;
    uint256 hSpawnTile;
    uint256 hSecret;
}
