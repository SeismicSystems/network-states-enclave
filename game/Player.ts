// @ts-ignore
import { groth16 } from "snarkjs";
import { Location, Tile } from "./Tile";
import { Utils } from "./Utils";
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
    blind: bigint;
    hBlind: string;

    constructor(symb: string, address: string, socketId?: string) {
        this.symbol = symb;
        this.address = address;

        this.sampleBlind();
    }

    public sampleBlind() {
        this.blind = genRandomSalt() as bigint;
        this.hBlind = poseidonPerm([BigInt(0), this.blind])[0].toString();
    }

    public hBlindLoc(l: Location): string {
        return Utils.poseidonExt([this.blind, l.r, l.c]).toString();
    }

    public async commitToSpawn(spawnLoc: Location, nStates: any) {
        const tx = await nStates.commitToSpawn(this.hBlindLoc(spawnLoc));
        await tx.wait();
    }

    public async spawnZKP(
        prevTile: Tile,
        spawnTile: Tile
    ) {
        const { proof, publicSignals } = await groth16.fullProve(
            {
                canSpawn: prevTile.isSpawnable() ? "1" : "0",
                spawnCityId: spawnTile.cityId.toString(),
                hPrevTile: prevTile.hash(),
                hSpawnTile: spawnTile.hash(),
                hBlindLoc: this.hBlindLoc(spawnTile.loc),
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
