// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface IEnclaveEvents {
    event NewTile(uint256 hTile);
    event NewMove(uint256 hUFrom, uint256 hUTo);
    event NewSpawn(address player);
}
