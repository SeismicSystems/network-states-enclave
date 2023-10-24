pragma circom 2.1.1;

include "../node_modules/maci-circuits/node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/maci-circuits/node_modules/circomlib/circuits/babyjub.circom";
include "../utils/utils.circom";

template Spawn() {
    var N_TL_ATRS = 7;
    var ROW_IDX = 0;
    var COL_IDX = 1;
    var RSRC_IDX = 2;
    var KEY_IDX = 3;
    var CITY_IDX = 4;
    var UPD_IDX = 5;
    var TYPE_IDX = 6;

    var CITY_TYPE = 1;
    var CAPITAL_TYPE = 2;
    var WATER_TYPE = 3;
    var HILL_TYPE = 4;

    var START_RESOURCES = 9;

    signal input canSpawn;
    signal input spawnCityId;
    signal input commitBlockHash;
    signal input hPrevTile;
    signal input hSpawnTile;
    signal input hSecret;

    signal input prevTile[N_TL_ATRS];
    signal input spawnTile[N_TL_ATRS];
    signal input secret;

    // Spawn tile must be correct
    // [TODO]: constrain row and column
    signal spawnTileCorrect <== BatchIsEqual(4)([
        [spawnTile[RSRC_IDX], START_RESOURCES],
        [spawnTile[CITY_IDX], spawnCityId],
        [spawnTile[UPD_IDX], 0],
        [spawnTile[TYPE_IDX], CAPITAL_TYPE]
    ]);
    spawnTileCorrect === 1;

    // Tiles hashed correctly
    signal circuitHPrevTile <== Poseidon(N_TL_ATRS)(prevTile);
    signal hPrevTileCorrect <== IsEqual()([circuitHPrevTile, hPrevTile]);
    hPrevTileCorrect === 1;

    signal circuitHSpawnTile <== Poseidon(N_TL_ATRS)(spawnTile);
    signal hSpawnTileCorrect <== IsEqual()([circuitHSpawnTile, hSpawnTile]);
    hSpawnTileCorrect === 1;

    // Constrain canSpawn
    signal isUnowned <== IsEqual()([prevTile[CITY_IDX], 0]);
    signal isOwned <== NOT()(isUnowned);
    signal isWater <== IsEqual()([prevTile[TYPE_IDX], WATER_TYPE]);
    signal isHill <== IsEqual()([prevTile[TYPE_IDX], HILL_TYPE]);
    signal isCity <== IsEqual()([prevTile[TYPE_IDX], CITY_TYPE]);
    signal isCapital <== IsEqual()([prevTile[TYPE_IDX], CAPITAL_TYPE]);
    
    signal circuitCanSpawn <== BatchIsZero(5)([isOwned, isWater, isHill, isCity, 
        isCapital]);
    signal canSpawnCorrect <== IsEqual()([circuitCanSpawn, canSpawn]);
    canSpawnCorrect === 1;

    // secret should hash to hSecret
    signal circuitHSecret <== Poseidon(1)([secret]);
    signal hSecretCorrect <== IsEqual()([circuitHSecret, hSecret]);
    hSecretCorrect === 1;
}
