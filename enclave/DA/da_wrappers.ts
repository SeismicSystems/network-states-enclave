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

export class EnclaveValuesDAWrapper {
    static async setValue(name: string, value: string) {
        await addorReplaceDataToDynamoDB("enclaveValues", { name, value });
    }

    static async getValue(name: string) {
        const res = await getDataFromDynamoDB("enclaveValues", { name });

        return res ? BigInt(res.value) : undefined;
    }

    static async setEnclaveBlind(blind: string) {
        await this.setValue("enclaveBlind", blind);
    }

    static async getEnclaveBlind() {
        return await this.getValue("enclaveBlind");
    }
}
