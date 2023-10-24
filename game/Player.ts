// @ts-ignore
import { groth16 } from "snarkjs";
import { Tile } from "./Tile";
import { genRandomSalt } from "maci-crypto";
/*
 * poseidonPerm is a modified version of iden3's poseidonPerm.js.
 */
const poseidonPerm = require("./poseidonPerm");

export class Player {
    static SPAWN_WASM: string = "../circuits/spawn/spawn.wasm";
    static SPAWN_PROVKEY: string = "../circuits/spawn/spawn.zkey";

    symbol: string;
    address: string;
    socketId?: string;
    secret: BigInt;

    constructor(symb: string, address: string, socketId?: string) {
        this.symbol = symb;
        this.address = address;
        if (socketId) {
            this.socketId = socketId;
        }
        this.secret = genRandomSalt();
    }

    public sampleSecret() {
        this.secret = genRandomSalt();
    }

    public async commitToSpawn(nStates: any) {
        const h = poseidonPerm([0, this.secret])[0].toString();
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
                prevTile: prevTile.toCircuitInput(),
                spawnTile: spawnTile.toCircuitInput(),
            },
            Player.SPAWN_WASM,
            Player.SPAWN_PROVKEY
        );

        return [proof, publicSignals];
    }
}
