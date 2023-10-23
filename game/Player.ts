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

    public async commitToSpawn(nStates: any) {
        const h = poseidonPerm([0, this.secret])[0].toString();
        const transaction = await nStates.commitToSpawn(h);
        
        // Wait to get the transaction block number
        const receipt = await transaction.wait();
        return receipt.blockNumber;
    }

    public async constructSpawn(
        commitBlockHash: string,
        unonwedTile: Tile,
        spawnTile: Tile,
        nStates: any
    ) {
        const { proof, publicSignals } = await groth16.fullProve(
            {
                commitBlockHash,
                hUnownedTile: unonwedTile.hash(),
                hSpawnTile: spawnTile.hash(),
                spawnCityId: spawnTile.cityId.toString(),
                spawnTile: spawnTile.toCircuitInput(),
            },
            Player.SPAWN_WASM,
            Player.SPAWN_PROVKEY
        );

        return [proof, publicSignals];
    }
}
