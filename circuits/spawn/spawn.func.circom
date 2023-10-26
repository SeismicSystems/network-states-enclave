pragma circom 2.1.1;

include "../node_modules/maci-circuits/node_modules/circomlib/circuits/poseidon.circom";
include "../utils/utils.circom";

template CheckSpawnTile(N_TL_ATRS, RSRC_IDX, CITY_IDX, UPD_IDX, TYPE_IDX,
    START_RESOURCES, CAPITAL_TYPE) {
    signal input spawnCityId;

    signal input spawnTile[N_TL_ATRS];

    signal output out <== BatchIsEqual(4)([
        [spawnTile[RSRC_IDX], START_RESOURCES],
        [spawnTile[CITY_IDX], spawnCityId],
        [spawnTile[UPD_IDX], 0],
        [spawnTile[TYPE_IDX], CAPITAL_TYPE]
    ]);
}

template CheckTileHashes(N_TL_ATRS) {
    signal input hPrevTile;
    signal input hSpawnTile;

    signal input prevTile[N_TL_ATRS];
    signal input spawnTile[N_TL_ATRS];

    signal output out;

    signal circuitHPrevTile <== Poseidon(N_TL_ATRS)(prevTile);
    signal hPrevTileCorrect <== IsEqual()([circuitHPrevTile, hPrevTile]);

    signal circuitHSpawnTile <== Poseidon(N_TL_ATRS)(spawnTile);
    signal hSpawnTileCorrect <== IsEqual()([circuitHSpawnTile, hSpawnTile]);

    out <== AND()(hPrevTileCorrect, hSpawnTileCorrect);
}

template CheckCanSpawn(N_TL_ATRS, CITY_IDX, TYPE_IDX, CITY_TYPE, CAPITAL_TYPE, 
    WATER_TYPE, HILL_TYPE) {
    signal input canSpawn;

    signal input prevTile[N_TL_ATRS];

    signal output out;

    signal isUnowned <== IsEqual()([prevTile[CITY_IDX], 0]);
    signal isOwned <== NOT()(isUnowned);
    signal isWater <== IsEqual()([prevTile[TYPE_IDX], WATER_TYPE]);
    signal isHill <== IsEqual()([prevTile[TYPE_IDX], HILL_TYPE]);
    signal isCity <== IsEqual()([prevTile[TYPE_IDX], CITY_TYPE]);
    signal isCapital <== IsEqual()([prevTile[TYPE_IDX], CAPITAL_TYPE]);
    
    signal circuitCanSpawn <== BatchIsZero(5)([isOwned, isWater, isHill, isCity, 
        isCapital]);
    out <== IsEqual()([circuitCanSpawn, canSpawn]);
}

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
    var WATER_TYPE = 2;
    var HILL_TYPE = 3;

    var START_RESOURCES = 9;

    signal input canSpawn;
    signal input spawnCityId;
    signal input commitBlockHash;
    signal input hPrevTile;
    signal input hSpawnTile;
    signal input hBlind;

    signal input prevTile[N_TL_ATRS];
    signal input spawnTile[N_TL_ATRS];
    signal input blind;

    // Spawn tile must be correct
    // [TODO]: constrain row and column
    signal spawnTileCorrect <== CheckSpawnTile(N_TL_ATRS, RSRC_IDX, CITY_IDX, 
        UPD_IDX, TYPE_IDX, START_RESOURCES, CAPITAL_TYPE)(spawnCityId, 
        spawnTile);
    spawnTileCorrect === 1;

    // Tiles hashed correctly
    signal tileHashesCorrect <== CheckTileHashes(N_TL_ATRS)(hPrevTile, 
        hSpawnTile, prevTile, spawnTile);
    tileHashesCorrect === 1;

    // Constrain canSpawn
    signal canSpawnCorrect <== CheckCanSpawn(N_TL_ATRS, CITY_IDX, TYPE_IDX, 
        CITY_TYPE, CAPITAL_TYPE, WATER_TYPE, HILL_TYPE)(canSpawn, prevTile);
    canSpawnCorrect === 1;

    // blind should hash to hBlind
    signal circuithBlind <== Poseidon(1)([blind]);
    signal hBlindCorrect <== IsEqual()([circuithBlind, hBlind]);
    hBlindCorrect === 1;
}
