pragma circom 2.1.1;

include "spawn.func.circom";

component main { public [ commitBlockHash, hUnownedTile, hSpawnTile, spawnCityId 
    ] } = Spawn();
    