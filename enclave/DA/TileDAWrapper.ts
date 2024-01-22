import { Tile } from "@seismic-systems/ns-fow-game";
import {
    addorReplaceDataToDynamoDB,
    deleteDataFromDynamoDB,
    getDataFromDynamoDB,
    updateDataToDynamoDB,
} from "./dynamodb_setup";

export class TileDAWrapper {
    static async saveTileToDA(tile: Tile) {
        await addorReplaceDataToDynamoDB("tiles", {
            tileHash: tile.hash(),
            ...tile.toJSON(),
        });
    }
}
