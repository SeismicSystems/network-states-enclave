// @ts-ignore
import { groth16 } from "snarkjs";
import { Tile } from "./Tile";
import { genRandomSalt } from "maci-crypto";
/*
 * poseidonPerm is a modified version of iden3's poseidonPerm.js.
 */
import poseidonPerm from "../game/poseidonPerm.js";

export class Player {
    static SPAWN_WASM: string = "../circuits/spawn/spawn.wasm";
    static SPAWN_PROVKEY: string = "../circuits/spawn/spawn.zkey";

    symbol: string;
    address: string;
    blind: BigInt;
    hBlind: string;

    constructor(symb: string, address: string, socketId?: string) {
        this.symbol = symb;
        this.address = address;
        
        this.sampleSecret();
    }

    public sampleSecret() {
        this.blind = genRandomSalt();
        this.hBlind = poseidonPerm([BigInt(0), this.blind])[0].toString();
    }

    public async commitToSpawn(nStates: any) {
        const h = poseidonPerm([BigInt(0), this.blind])[0].toString();
        const transaction = await nStates.commitToSpawn(h);

        // Wait to get the transaction block number
        const receipt = await transaction.wait();
        return receipt.blockNumber;
    }

    public async constructSpawn(
        commitBlockHash: string,
        prevTile: Tile,
        spawnTile: Tile
    ) {
        const { proof, publicSignals } = await groth16.fullProve(
            {
                canSpawn: prevTile.isSpawnable() ? "1" : "0",
                spawnCityId: spawnTile.cityId.toString(),
                commitBlockHash: commitBlockHash.toString(),
                hPrevTile: prevTile.hash(),
                hSpawnTile: spawnTile.hash(),
                hBlind: this.hBlind,
                prevTile: prevTile.toCircuitInput(),
                spawnTile: spawnTile.toCircuitInput(),
                blind: this.blind.toString(),
            },
            Player.SPAWN_WASM,
            Player.SPAWN_PROVKEY
        );

        return [proof, publicSignals];
    }
}
