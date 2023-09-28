// @ts-ignore
import { groth16 } from "snarkjs";
import { Groth16Proof, Utils } from "./Utils";
import { Player } from "./Player";
import { Tile, Location } from "./Tile";
import { IncrementalQuinTree } from "maci-crypto";

export class Board {
    static MOVE_WASM: string = "../circuits/move/move.wasm";
    static MOVE_PROVKEY: string = "../circuits/move/move.zkey";
    static PERIMETER: number[][] = [-1, 0, 1].flatMap((x) =>
        [-1, 0, 1].map((y) => [x, y])
    );

    t: Tile[][];

    playerTiles: Map<string, Location[]>;

    playerCapitals: Map<string, Location>;

    public constructor() {
        this.t = new Array<Array<Tile>>();
        this.playerTiles = new Map<string, Location[]>();
        this.playerCapitals = new Map<string, Location>();
    }

    /*
     * Seed game board by sampling access key for each tile, updating on-chain
     * merkle tree along the way. Doesn't do any sampling if isInit flag is off.
     * With that setting, it only initializes board with mystery tiles.
     */
    public async seed(sz: number, isInit: boolean, nStates: any) {
        for (let i = 0; i < sz; i++) {
            let row: Tile[] = new Array<Tile>();
            for (let j = 0; j < sz; j++) {
                if (isInit) {
                    let tl: Tile;
                    if (i === 0 && j === 1) {
                        tl = Tile.hill({ r: i, c: j });
                    } else if (i === 1 && j === 1) {
                        tl = Tile.water({ r: i, c: j });
                    } else {
                        tl = Tile.genUnowned({ r: i, c: j });
                    }
                    await nStates.set(tl.hash());
                    await Utils.sleep(200);
                    row.push(tl);
                } else {
                    row.push(Tile.mystery({ r: i, c: j }));
                }
            }
            this.t.push(row);
        }
    }

    /*
     * Check if a location = (row, col) pair is within the bounds of the board.
     */
    public inBounds(r: number, c: number): boolean {
        return r < this.t.length && r >= 0 && c < this.t[0].length && c >= 0;
    }

    /*
     * Throws an error if a presented location isn't in bounds.
     */
    private assertBounds(l: Location) {
        if (!this.inBounds(l.r, l.c)) {
            throw new Error("Tried to edit tile out of bounds.");
        }
    }

    /*
     * Spawn Player at a Location. Used for development. Enclave only func.
     */
    public async spawn(
        l: Location,
        pl: Player,
        resource: number,
        cityId: number,
        nStates: any
    ) {
        this.assertBounds(l);

        let r = l.r,
            c = l.c;
        if (!this.t[r][c].isUnowned()) {
            throw new Error("Tried to spawn player on an owned tile.");
        }

        // Before tile is changed, we need the nullifier.
        const nullifier = this.t[r][c].nullifier();

        const tl = Tile.genOwned(
            pl,
            { r, c },
            resource,
            cityId,
            0,
            0,
            Tile.CAPITAL_TILE
        );

        this.setTile(tl);

        this.playerCapitals.set(pl.bjjPub.serialize(), { r, c });

        // Update the merkle root on-chain.
        await nStates.spawn(
            pl.pubKeyHash(),
            cityId,
            this.t[r][c].hash(),
            nullifier
        );
        await Utils.sleep(200);
    }

    /*
     * Does the player have a capital? Enclave function.
     */
    public isSpawned(pl: Player): boolean {
        return this.playerCapitals.has(pl.bjjPub.serialize());
    }

    /*
     * Displays colored gameboard. Local belief of what the gameboard is from
     * the perspective of the client.
     */
    public printView(): void {
        for (let i = 0; i < this.t.length; i++) {
            for (let j = 0; j < this.t[0].length; j++) {
                let tl: Tile = this.getTile({ r: i, c: j });
                let color;
                const reset = "\x1b[0m";
                if (tl.tileType === Tile.WATER_TILE) {
                    color = "\x1b[36m";
                } else if (tl.tileType === Tile.HILL_TILE) {
                    color = "\x1b[90m";
                } else if (tl.owner.symbol === "A") {
                    color = "\x1b[32m";
                } else if (tl.owner.symbol === "B") {
                    color = "\x1b[31m";
                } else if (tl.owner.symbol === "C") {
                    color = "\x1b[44m";
                } else {
                    color = "\x1b[37m";
                }
                process.stdout.write(color + `[${tl.owner.symbol}]` + reset);
            }
            process.stdout.write("\n");
        }
        process.stdout.write("---\n");
    }

    /*
     * Getter for Tile at a location.
     */
    public getTile(l: Location): Tile {
        this.assertBounds(l);
        return this.t[l.r][l.c];
    }

    public getNearbyLocations(l: Location): Location[] {
        let locs: Location[] = [];
        for (let r = l.r - 1; r <= l.r + 1; r++) {
            for (let c = l.c - 1; c <= l.c + 1; c++) {
                if (this.inBounds(r, c)) {
                    locs.push({ r, c });
                }
            }
        }
        return locs;
    }

    /*
     * Set location to new Tile value. Enclave-only func.
     */
    public setTile(tl: Tile) {
        const oldTile = this.t[tl.loc.r][tl.loc.c];
        const oldPubKey = oldTile.owner.bjjPub.serialize();
        const newPubKey = tl.owner.bjjPub.serialize();
        if (oldPubKey != newPubKey) {
            // Remove tile from old player and give to new player
            const index = this.playerTiles.get(oldPubKey)?.indexOf(tl.loc);
            if (index) {
                this.playerTiles.get(oldPubKey)?.splice(index, 1);
            }

            const newPubKey = tl.owner.bjjPub.serialize();
            const newOwnerTiles = this.playerTiles.get(newPubKey);
            if (newOwnerTiles) {
                newOwnerTiles.push(tl.loc);
            } else {
                this.playerTiles.set(newPubKey, [tl.loc]);
            }

            // If setTile is over a capital, remove capital from player
            const capitalLoc = this.playerCapitals.get(oldPubKey);
            if (
                capitalLoc &&
                capitalLoc.r === tl.loc.r &&
                capitalLoc.c === tl.loc.c
            ) {
                this.playerCapitals.delete(oldPubKey);
            }
        }

        this.t[tl.loc.r][tl.loc.c] = tl;
    }

    /*
     * Check if a location is NOT in the FoW for requesting player. Enclave-only
     * func.
     */
    public noFog(l: Location, reqPlayer: Player): boolean {
        let r = l.r,
            c = l.c;
        let foundNeighbor = false;
        Board.PERIMETER.forEach(([dy, dx]) => {
            let nr = r + dy,
                nc = c + dx;
            if (
                this.inBounds(nr, nc) &&
                this.t[nr][nc].owner.bjjPub.equals(reqPlayer.bjjPub)
            ) {
                foundNeighbor = true;
            }
        });
        return foundNeighbor;
    }

    /*
     * Returns true if every Tile in this board instance is a Mystery. Only
     * happens when not player isn't spawned yet.
     */
    public noVisibility() {
        for (let i = 0; i < this.t.length; i++) {
            for (let j = 0; j < this.t[0].length; j++) {
                const tl: Tile = this.getTile({ r: i, c: j });
                if (!tl.isMystery()) {
                    return false;
                }
            }
        }
        return true;
    }

    /*
     * Computes the number of troops on tile after considering troop/water
     * updates.
     */
    static computeUpdatedTroops(
        tTile: Tile,
        currentTroopInterval: number,
        currentWaterInterval: number
    ): number {
        const isUnowned: number = tTile.isUnowned() ? 0 : 1;
        const deltaTroops: number = tTile.isWater()
            ? tTile.latestWaterUpdateInterval - currentWaterInterval
            : 0;

        let updatedTroops = (tTile.resources + deltaTroops) * isUnowned;
        if (updatedTroops < 0) {
            updatedTroops = 0;
        }
        return updatedTroops;
    }

    /*
     * Computes proper state of tile an army is about to move onto. Goes through
     * game logic of what happens during a battle.
     */
    static computeOntoTile(
        tTo: Tile,
        tFrom: Tile,
        uFrom: Tile,
        updatedTroops: number,
        nMobilize: number,
        currentTroopInterval: number,
        currentWaterInterval: number
    ): Tile {
        if (nMobilize < 1) {
            throw Error("Cannot move without mobilizing at least 1 troop.");
        }
        let uTo: Tile;
        if (tTo.owner === tFrom.owner) {
            uTo = Tile.genOwned(
                tTo.owner,
                tTo.loc,
                updatedTroops + nMobilize,
                tTo.cityId,
                currentTroopInterval,
                currentWaterInterval,
                tTo.tileType
            );
        } else if (tTo.isUnowned()) {
            uTo = Tile.genOwned(
                tFrom.owner,
                tTo.loc,
                nMobilize,
                tFrom.cityId,
                currentTroopInterval,
                currentWaterInterval,
                tTo.tileType
            );
        } else {
            uTo = Tile.genOwned(
                tTo.owner,
                tTo.loc,
                updatedTroops - nMobilize,
                tTo.cityId,
                currentTroopInterval,
                currentWaterInterval,
                tTo.tileType
            );
            if (uTo.resources < 0) {
                uTo.owner = uFrom.owner;
                uTo.resources *= -1;
                if (
                    tTo.tileType != Tile.CITY_TILE &&
                    tTo.tileType != Tile.CAPITAL_TILE
                ) {
                    uTo.cityId = uFrom.cityId;
                } else if (tTo.tileType === Tile.CAPITAL_TILE) {
                    uTo.tileType = Tile.CITY_TILE;
                }
            }
        }
        return uTo;
    }

    /*
     * Generates state transition, nullifier combo, and ZKP needed to move
     * troops from one tile to another. Moves all but one troop for development.
     */
    public async constructMove(
        mTree: IncrementalQuinTree,
        bjjPrivKeyHash: BigInt,
        from: Location,
        to: Location,
        currentTroopInterval: number,
        currentWaterInterval: number
    ): Promise<[Tile, Tile, Tile, Tile, Groth16Proof, any]> {
        const tFrom: Tile = this.getTile(from);
        const tTo: Tile = this.getTile(to);

        // Most recent troop counts
        const fromUpdatedTroops = Board.computeUpdatedTroops(
            tFrom,
            currentTroopInterval,
            currentWaterInterval
        );
        const toUpdatedTroops = Board.computeUpdatedTroops(
            tTo,
            currentTroopInterval,
            currentWaterInterval
        );

        const nMobilize = fromUpdatedTroops - 1;

        const uFrom: Tile = Tile.genOwned(
            tFrom.owner,
            tFrom.loc,
            fromUpdatedTroops - nMobilize,
            tFrom.cityId,
            currentTroopInterval,
            currentWaterInterval,
            tFrom.tileType
        );
        const uTo: Tile = Board.computeOntoTile(
            tTo,
            tFrom,
            uFrom,
            toUpdatedTroops,
            nMobilize,
            currentTroopInterval,
            currentWaterInterval
        );

        const ontoSelfOrUnowned =
            tTo.owner === tFrom.owner || tTo.isUnowned() ? "1" : "0";
        const takingCity = tTo.isCity() && uTo.owner != tTo.owner ? "1" : "0";
        const takingCapital =
            tTo.isCapital() && uTo.owner != tTo.owner ? "1" : "0";

        const mProofFrom = Utils.generateMerkleProof(tFrom.hash(), mTree);
        const mProofTo = Utils.generateMerkleProof(tTo.hash(), mTree);

        const { proof, publicSignals } = await groth16.fullProve(
            {
                root: mTree.root.toString(),
                currentTroopInterval: currentTroopInterval.toString(),
                currentWaterInterval: currentWaterInterval.toString(),
                fromPkHash: tFrom.owner.pubKeyHash(),
                fromCityId: tFrom.cityId.toString(),
                toCityId: tTo.cityId.toString(),
                ontoSelfOrUnowned,
                takingCity,
                takingCapital,
                hUFrom: uFrom.hash(),
                hUTo: uTo.hash(),
                rhoFrom: tFrom.nullifier(),
                rhoTo: tTo.nullifier(),
                tFrom: tFrom.toCircuitInput(),
                tFromPathIndices: mProofFrom.indices,
                tFromPathElements: mProofFrom.pathElements,
                tTo: tTo.toCircuitInput(),
                tToPathIndices: mProofTo.indices,
                tToPathElements: mProofTo.pathElements,
                uFrom: uFrom.toCircuitInput(),
                uTo: uTo.toCircuitInput(),
                fromUpdatedTroops: fromUpdatedTroops.toString(),
                toUpdatedTroops: toUpdatedTroops.toString(),
                privKeyHash: bjjPrivKeyHash.toString(),
            },
            Board.MOVE_WASM,
            Board.MOVE_PROVKEY
        );

        return [tFrom, tTo, uFrom, uTo, proof, publicSignals];
    }
}
