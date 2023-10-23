pragma circom 2.1.1;

include "../node_modules/maci-circuits/node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/maci-circuits/node_modules/circomlib/circuits/babyjub.circom";

template Spawn() {
    var N_TL_ATRS = 7;
    var ROW_IDX = 0;
    var COL_IDX = 1;
    var RSRC_IDX = 2;
    var KEY_IDX = 3;
    var CITY_IDX = 4;
    var UPD_IDX = 5;
    var TYPE_IDX = 6;

    var CAPITAL_TYPE = 2;

    var START_RESOURCES = 9;

    signal input commitBlockHash;
    signal input hUnownedTile;
    signal input hSpawnTile;
    signal input spawnCityId;

    signal input spawnTile[N_TL_ATRS];

    // Spawn tile must be correct
    // [TODO]: move into batch
    // [TODO]: constrain row and column

    signal rsrcCorrect <== IsEqual()([spawnTile[RSRC_IDX], START_RESOURCES]);
    rsrcCorrect === 1;

    signal cityIdCorrect <== IsEqual()([spawnTile[CITY_IDX], spawnCityId]);
    cityIdCorrect === 1;

    // [TODO]: this isn't really necessary: the tile will not be a water tile
    signal updateIntervalCorrect <== IsZero()(spawnTile[UPD_IDX]);
    updateIntervalCorrect === 1;

    signal typeIdCorrect <== IsEqual()([spawnTile[TYPE_IDX], CAPITAL_TYPE]);
    typeIdCorrect === 1;

    // Tile hashed correctly
    signal circuitHSpawnTile <== Poseidon(N_TL_ATRS)(spawnTile);
    signal hSpawnTileCorrect <== IsEqual()([circuitHSpawnTile, hSpawnTile]);
    hSpawnTileCorrect === 1;
}
