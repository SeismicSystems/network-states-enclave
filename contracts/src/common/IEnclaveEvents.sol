// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface IEnclaveEvents {
    event NewTile(uint256 indexed hTile);
    event NewMove(uint256 indexed hUFrom, uint256 indexed hUTo);
    event NewSpawnAttempt(address indexed player, uint256 indexed hSpawn, bool indexed success);
}
