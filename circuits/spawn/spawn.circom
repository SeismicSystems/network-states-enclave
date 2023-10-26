pragma circom 2.1.1;

include "spawn.func.circom";

component main { public [ canSpawn, spawnCityId, commitBlockHash, hPrevTile, 
    hSpawnTile, hBlind ] } = Spawn();
