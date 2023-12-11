// @ts-ignore
import { Utils, Location } from "./Utils";
import { genRandomSalt } from "maci-crypto";
/*
 * poseidonPerm is a modified version of iden3's poseidonPerm.js.
 */
import poseidonPerm from "./poseidonPerm";

export class Player {
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
        return Utils.poseidonExt([
            this.blind,
            BigInt(l.r),
            BigInt(l.c),
        ]).toString();
    }

    public async commitHBlind(spawnLoc: Location, nStates: any) {
        const tx = await nStates.commitToSpawn(this.hBlindLoc(spawnLoc));
        await tx.wait();
    }
}
