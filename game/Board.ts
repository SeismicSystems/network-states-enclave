// @ts-ignore
import { groth16 } from "snarkjs";
import { Utils, Location, Groth16Proof } from "./Utils.js";
import { Player } from "./Player.js";
import { Tile } from "./Tile.js";
import dotenv from "dotenv";
import { TerrainUtils } from "./Terrain.js";
dotenv.config({ path: "../.env" });

export class Board {
    static MOVE_WASM: string = "../circuits/move/move.wasm";
    static MOVE_PROVKEY: string = "../circuits/move/move.zkey";
    static PERIMETER: number[][] = [-1, 0, 1].flatMap((x) =>
        [-1, 0, 1].map((y) => [x, y])
    );
    static SNARK_FIELD_SIZE: number = Number(
        <string>process.env.SNARK_FIELD_SIZE
    );
    static COORDINATE_MAX_VALUE: number = 2 ** 31;

    t: Map<string, Tile>;
    terrainUtils: TerrainUtils;

    playerCities: Map<string, Set<number>>;
    cityTiles: Map<number, Set<string>>;

    public constructor(terrainUtils: TerrainUtils) {
        this.t = new Map<string, Tile>();
        this.terrainUtils = terrainUtils;

        this.playerCities = new Map<string, Set<number>>();
        this.cityTiles = new Map<number, Set<string>>();
    }

    /*
     * Check if a location = (row, col) pair is within the bounds of the board.
     */
    public inBounds(r: number, c: number): boolean {
        return (
            r <= Board.COORDINATE_MAX_VALUE &&
            r >= 0 &&
            c <= Board.COORDINATE_MAX_VALUE &&
            c >= 0
        );
    }

    /*
     * Throws an error if a presented location isn't in bounds.
     */
    private assertBounds(l: Location): boolean {
        return this.inBounds(l.r, l.c);
    }

    /*
     * Populates the board with mystery tiles in a 10x10 grid.
     */
    public seed() {
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                const loc: Location = { r, c };
                const tile: Tile = Tile.mystery(loc);
                this.t.set(Utils.stringifyLocation(loc), tile);
            }
        }
    }

    /*
     * Spawn Player at a Location. Used for development. Enclave only func.
     */
    public async spawn(
        l: Location,
        pl: Player,
        resource: number,
        cityId: number
    ) {
        this.assertBounds(l);

        if (!this.getTile(l, 0n).isUnowned()) {
            console.error("Tried to spawn player on an owned tile.");
            return;
        }

        const tl = Tile.genOwned(pl, l, resource, cityId, 0, Tile.CITY_TILE);

        this.setTile(tl);

        this.playerCities.set(pl.address, new Set<number>().add(cityId));
        this.cityTiles.set(
            cityId,
            new Set<string>().add(Utils.stringifyLocation(l))
        );
    }

    /*
     * Does the player have a city? Enclave function.
     */
    public isSpawned(pl: Player): boolean {
        const cities = this.playerCities.get(pl.address);
        return cities && cities.size > 0;
    }

    /*
     * Displays colored gameboard. Local belief of what the gameboard is from
     * the perspective of the client.
     */
    public printView(): void {
        for (let r = 0; r < 25; r++) {
            for (let c = 0; c < 25; c++) {
                let tl: Tile = this.getTile({ r, c }, 0n);
                let color;
                const reset = "\x1b[0m";
                if (tl.isBare() && tl.resources === 5 && tl.isUnowned()) {
                    color = "\x1b[33m";
                    process.stdout.write(color + `[5]` + reset);
                } else if (tl.isWater()) {
                    color = "\x1b[36m";
                    process.stdout.write(color + `[~]` + reset);
                } else if (tl.isHill()) {
                    color = "\x1b[90m";
                    process.stdout.write(color + `[^]` + reset);
                } else if (tl.owner.symbol === "A") {
                    color = "\x1b[32m";
                    process.stdout.write(color + `[${tl.owner.symbol}]` + reset);
                } else if (tl.owner.symbol === "B") {
                    color = "\x1b[31m";
                    process.stdout.write(color + `[${tl.owner.symbol}]` + reset);
                } else if (tl.owner.symbol === "C") {
                    color = "\x1b[44m";
                    process.stdout.write(color + `[${tl.owner.symbol}]` + reset);
                } else {
                    color = "\x1b[37m";
                    process.stdout.write(color + `[_]` + reset);
                }
            }
            process.stdout.write("\n");
        }
        process.stdout.write("---\n");
    }

    /*
     * Getter for Tile at a location, or undefined if passed in location is
     * invalid.
     */
    public getTile(l: Location, r: bigint): Tile | undefined {
        if (this.assertBounds(l)) {
            let tl = this.t.get(Utils.stringifyLocation(l));
            if (!tl) {
                tl = Tile.genVirtual(l, r, this.terrainUtils);
            }
            return tl;
        }
        return undefined;
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
        const oldTile = this.getTile(tl.loc, 0n);
        const oldOwner = oldTile.owner.address;
        const newOwner = tl.owner.address;

        if (!this.isSpawned(tl.owner)) {
            // Initialize player's data
            this.playerCities.set(newOwner, new Set<number>().add(tl.cityId));
            this.cityTiles.set(
                tl.cityId,
                new Set<string>().add(Utils.stringifyLocation(tl.loc))
            );
        } else {
            if (oldOwner !== newOwner) {
                // Some type of capture happened: must update state
                if (oldTile.isCityCenter()) {
                    // Change tile ownership
                    for (let locString of this.cityTiles.get(oldTile.cityId)!) {
                        const loc = JSON.parse(locString);
                        if (loc) {
                            this.getTile(loc, 0n).owner = tl.owner;
                        }
                    }

                    this.playerCities.get(oldOwner)?.delete(tl.cityId);
                    this.playerCities.get(newOwner)?.add(tl.cityId);

                    // Check if oldOwner lost all cities
                    const cities = this.playerCities.get(oldOwner);
                    if (cities && cities.size == 0) {
                        this.playerCities.delete(oldOwner);
                    }
                } else {
                    // Bare/water tile with a new owner
                    const locString = Utils.stringifyLocation(tl.loc);
                    this.cityTiles.get(oldTile.cityId)?.delete(locString);
                    this.cityTiles.get(tl.cityId)?.add(locString);
                }
                this.playerCities.delete(oldOwner);
            } else if (oldTile.isCityCenter()) {
                // Change tile ownership
                for (let locString of this.cityTiles.get(oldTile.cityId)!) {
                    const tile = this.t.get(locString);
                    if (tile) {
                        tile.owner = oldTile.owner;
                        this.t.set(locString, tile);
                    }
                }

                this.playerCities.get(oldOwner)?.delete(tl.cityId);
                this.playerCities.get(newOwner)?.add(tl.cityId);
            } else {
                // Bare/water tile with a new owner
                const locString = Utils.stringifyLocation(tl.loc);
                this.cityTiles.get(oldTile.cityId)?.delete(locString);
                this.cityTiles.get(tl.cityId)?.add(locString);
            }
        }
        this.t.set(Utils.stringifyLocation(tl.loc), tl);
    }

    /*
     * Check if a location is NOT in the FoW for requesting player. Enclave-only
     * func.
     */
    public noFog(l: Location, reqPlayer: Player, r: bigint): boolean {
        let foundNeighbor = false;
        Board.PERIMETER.forEach(([dy, dx]) => {
            let nr = l.r + dy,
                nc = l.c + dx;
            let tl = this.getTile({ r: nr, c: nc }, r);
            if (
                tl &&
                this.playerCities.get(reqPlayer.address)?.has(tl.cityId)
            ) {
                foundNeighbor = true;
            }
        });
        return foundNeighbor;
    }

    /*
     * Computes the number of troops on tile after considering troop/water
     * updates.
     */
    static computeUpdatedTroops(
        tTile: Tile,
        cityTroops: number,
        currentWaterInterval: number
    ): number {
        if (tTile.isWater()) {
            const deltaTroops =
                tTile.latestUpdateInterval - currentWaterInterval;
            return Math.max(tTile.resources + deltaTroops, 0);
        } else if (tTile.isCityCenter()) {
            return cityTroops;
        }

        return tTile.resources;
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
        currentWaterInterval: number
    ): Tile {
        if (nMobilize < 1) {
            throw Error("Cannot move without mobilizing at least 1 troop.");
        }
        let uTo: Tile;
        if (tTo.owner.address === tFrom.owner.address) {
            uTo = Tile.genOwned(
                tTo.owner,
                tTo.loc,
                updatedTroops + nMobilize,
                tTo.cityId,
                currentWaterInterval,
                tTo.tileType
            );
        } else if (tTo.isUnowned()) {
            uTo = Tile.genOwned(
                tFrom.owner,
                tTo.loc,
                nMobilize + tTo.resources,
                tFrom.cityId,
                currentWaterInterval,
                tTo.tileType
            );
        } else {
            uTo = Tile.genOwned(
                tTo.owner,
                tTo.loc,
                updatedTroops - nMobilize,
                tTo.cityId,
                currentWaterInterval,
                tTo.tileType
            );
            if (uTo.resources < 0) {
                uTo.owner = uFrom.owner;
                uTo.resources *= -1;
                if (tTo.tileType != Tile.CITY_TILE) {
                    uTo.cityId = uFrom.cityId;
                }
            }
        }
        return uTo;
    }

    /*
     * Generates state transition, nullifier combo, and ZKP needed to move
     * troops from one tile to another. Moves all but one troop for development.
     */
    public async moveZKP(
        from: Location,
        to: Location,
        nStates: any
    ): Promise<[Tile, Tile, Tile, Tile, Groth16Proof, any]> {
        const tFrom: Tile = this.getTile(from, 0n);
        const tTo: Tile = this.getTile(to, 0n);

        const currentWaterInterval = (
            await nStates.getCurrentInterval()
        ).toNumber();
        const fromCityTroops = await nStates.getCityCenterTroops(tFrom.cityId);
        const toCityTroops = await nStates.getCityCenterTroops(tTo.cityId);

        // Most recent troop counts
        const fromUpdatedTroops = Board.computeUpdatedTroops(
            tFrom,
            fromCityTroops,
            currentWaterInterval
        );
        const toUpdatedTroops = Board.computeUpdatedTroops(
            tTo,
            toCityTroops,
            currentWaterInterval
        );

        const nMobilize = fromUpdatedTroops - 1;

        const uFrom: Tile = Tile.genOwned(
            tFrom.owner,
            tFrom.loc,
            fromUpdatedTroops - nMobilize,
            tFrom.cityId,
            currentWaterInterval,
            tFrom.tileType
        );
        const uTo: Tile = Board.computeOntoTile(
            tTo,
            tFrom,
            uFrom,
            toUpdatedTroops,
            nMobilize,
            currentWaterInterval
        );

        const enemyLoss = Math.min(toUpdatedTroops, nMobilize);
        const ontoSelfOrUnowned =
            tTo.owner.address === tFrom.owner.address || tTo.isUnowned()
                ? "1"
                : "0";
        const capturedTile = uTo.owner.address != tTo.owner.address;
        const takingCity = tTo.isCityCenter() && capturedTile ? "1" : "0";

        const { proof, publicSignals } = await groth16.fullProve(
            {
                currentWaterInterval: currentWaterInterval.toString(),
                fromCityId: tFrom.cityId.toString(),
                toCityId: tTo.cityId.toString(),
                ontoSelfOrUnowned,
                numTroopsMoved: nMobilize.toString(),
                enemyLoss: enemyLoss.toString(),
                fromIsCityCenter: tFrom.isCityCenter() ? "1" : "0",
                toIsCityCenter: tTo.isCityCenter() ? "1" : "0",
                fromIsWaterTile: tFrom.isWater() ? "1" : "0",
                toIsWaterTile: tTo.isWater() ? "1" : "0",
                takingCity,
                fromCityTroops: fromCityTroops.toString(),
                toCityTroops: toCityTroops.toString(),
                hTFrom: tFrom.hash(),
                hTTo: tTo.hash(),
                hUFrom: uFrom.hash(),
                hUTo: uTo.hash(),
                tFrom: tFrom.toCircuitInput(),
                tTo: tTo.toCircuitInput(),
                uFrom: uFrom.toCircuitInput(),
                uTo: uTo.toCircuitInput(),
                fromUpdatedTroops: fromUpdatedTroops.toString(),
                toUpdatedTroops: toUpdatedTroops.toString(),
            },
            Board.MOVE_WASM,
            Board.MOVE_PROVKEY
        );

        return [tFrom, tTo, uFrom, uTo, proof, publicSignals];
    }
}
