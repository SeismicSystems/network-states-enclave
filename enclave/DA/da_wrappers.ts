import { Tile } from "@seismic-systems/ns-fow-game";
import {
    addorReplaceDataToDynamoDB,
    getDataFromDynamoDB,
} from "./dynamodb_setup";

export class ClaimedTileDAWrapper {
    static async saveClaimedTile(tile: Tile) {
        await addorReplaceDataToDynamoDB("claimedTiles", {
            hash: tile.hash(),
            tileJSON: tile.toJSON(),
        });
    }

    static async getClaimedTile(hash: string) {
        const res = await getDataFromDynamoDB("claimedTiles", { hash });
        
        return res ? Tile.fromJSON(res.tileJSON) : undefined;
    }
}
