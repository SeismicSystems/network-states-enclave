// @ts-ignore
import { groth16 } from "snarkjs";
import { Groth16Proof, Terrain } from "./Utils.js";
import { genRandomSalt } from "maci-crypto";
import { Player } from "./Player.js";
import { Utils } from "./Utils.js";
import { TerrainUtils } from "./Terrain.js";

export type Location = {
    r: number;
    c: number;
};

export class Tile {
    static UNOWNED: Player = new Player("_", "");
    static MYSTERY: Player = new Player("?", "");

    static VIRT_WASM: string = "../circuits/virtual/virtual.wasm";
    static VIRT_PROVKEY: string = "../circuits/virtual/virtual.zkey";

    // If cityId = 0 then the tile is considered unowned
    static UNOWNED_ID: number = 0;

    // tileType options
    static BARE_TILE: number = 0;
    static CITY_TILE: number = 1;
    static WATER_TILE: number = 2;
    static HILL_TILE: number = 3;

    owner: Player;
    loc: Location;
    resources: number;
    key: bigint;
    cityId: number;
    latestUpdateInterval: number;
    tileType: number;

    constructor(
        own_: Player,
        loc_: Location,
        rsrc_: number,
        key_: bigint,
        cityId_: number,
        interval_: number,
        tp_: number
    ) {
        this.owner = own_;
        this.loc = loc_;
        this.resources = rsrc_;
        this.key = key_;
        this.cityId = cityId_;
        this.latestUpdateInterval = interval_;
        this.tileType = tp_;
    }

    /*
     * Represent Tile as an array of bigint values to pass into the circuit.
     */
    toCircuitInput(): string[] {
        return [
            this.loc.r.toString(),
            this.loc.c.toString(),
            this.resources.toString(),
            this.key.toString(),
            this.cityId.toString(),
            this.latestUpdateInterval.toString(),
            this.tileType.toString(),
        ];
    }

    /*
     * Compute hash of this Tile and convert it into a decimal string.
     */
    hash(): string {
        return Utils.poseidonExt([
            ...this.toCircuitInput().map((e) => BigInt(e)),
        ]).toString();
    }

    /*
     * Compute the nullifier, defined as the hash of access key. Returns decimal
     * string representation.
     */
    nullifier(): string {
        return Utils.poseidonExt([this.key]).toString();
    }

    /*
     * Convert to JSON object with all values as strings.
     */
    toJSON(): object {
        return {
            symbol: this.owner.symbol,
            address: this.owner.address,
            r: this.loc.r.toString(),
            c: this.loc.c.toString(),
            resources: this.resources.toString(),
            key: this.key.toString(10),
            cityId: this.cityId.toString(),
            latestUpdateInterval: this.latestUpdateInterval.toString(),
            tileType: this.tileType.toString(),
        };
    }

    /*
     * Return true if this Tile is not owned by any player.
     */
    isUnowned(): boolean {
        return this.cityId === Tile.UNOWNED_ID;
    }

    /*
     * Return true if this Tile is in the fog for the current player view.
     */
    isMystery(): boolean {
        return this.owner.symbol === Tile.MYSTERY.symbol;
    }

    /*
     * Return true if this Tile is a water tile.
     */
    isWater(): boolean {
        return this.tileType === Tile.WATER_TILE;
    }

    /*
     * Return true if this Tile is a hill tile.
     */
    isHill(): boolean {
        return this.tileType === Tile.HILL_TILE;
    }

    /*
     * Return true if this Tile is a city.
     */
    isCityCenter(): boolean {
        return this.tileType === Tile.CITY_TILE;
    }

    /*
     * Return true if player should be allowed to spawn over this tile.
     */
    isSpawnable(): boolean {
        return (
            this.isUnowned() &&
            !this.isWater() &&
            !this.isHill() &&
            !this.isCityCenter()
        );
    }

    /*
     * Generates a ZKP that attests to the faithful computation of a virtual
     * tile given some committed randomness. Requester of this ZKP also provides
     * a blinding factor for location so they can use it in their client-side
     * ZKP.
     */
    static async virtualZKP(
        loc: Location,
        rand: bigint,
        hRand: bigint,
        terrainUtils: TerrainUtils
    ): Promise<[Groth16Proof, any]> {
        const v: Tile = Tile.genVirtual(loc, rand, terrainUtils);
        const { proof, publicSignals } = await groth16.fullProve(
            {
                hRand: hRand.toString(),
                hVirt: v.hash(),
                rand: rand.toString(),
                virt: v.toCircuitInput(),
            },
            Tile.VIRT_WASM,
            Tile.VIRT_PROVKEY
        );
        return [proof, publicSignals];
    }

    /*
     * Convert JSON object to Tile.
     */
    static fromJSON(obj: any): Tile {
        return new Tile(
            new Player(obj.symbol, obj.address),
            { r: Number(obj.r), c: Number(obj.c) },
            parseInt(obj.resources, 10),
            BigInt(obj.key),
            parseInt(obj.cityId, 10),
            parseInt(obj.latestUpdateInterval, 10),
            parseInt(obj.tileType, 10)
        );
    }

    /*
     * Meant to represent a tile in the fog of war.
     */
    static mystery(l: Location): Tile {
        return new Tile(Tile.MYSTERY, l, 0, BigInt(0), 0, 0, this.BARE_TILE);
    }

    /*
     * Hill tile. Players cannot move onto a hill tile.
     */
    static hill(l: Location, r: bigint): Tile {
        return new Tile(
            Tile.UNOWNED,
            l,
            0,
            Tile.proceduralSalt(l, r),
            0,
            0,
            this.HILL_TILE
        );
    }

    /*
     * New virtual / unowned tile.
     */
    static genVirtual(
        l: Location,
        r: bigint,
        terrainUtils: TerrainUtils
    ): Tile {
        return new Tile(
            Tile.UNOWNED,
            l,
            0,
            Tile.proceduralSalt(l, r),
            0,
            0,
            Tile.terrainAt(l, terrainUtils)
        );
    }

    /*
     * Compute procedural access key at a given location for a given committed
     * random value.
     */
    static proceduralSalt(l: Location, r: bigint): bigint {
        return Utils.poseidonExt([r, BigInt(l.r), BigInt(l.c)]);
    }

    /*
     * Return type value corresponding to output of getTerrainAtLoc
     */
    static terrainAt(l: Location, terrainUtils: TerrainUtils): number {
        const terrainValue = terrainUtils.getTerrainAtLoc(l);
        switch (terrainValue) {
            case Terrain.WATER:
                return this.WATER_TILE;
            case Terrain.HILL:
                return this.HILL_TILE;
            default:
                return this.BARE_TILE;
        }
    }

    /*
     * New owned tile with random salt as the access key.
     */
    static genOwned(
        owner: Player,
        loc: Location,
        rsrc: number,
        cityId: number,
        interval: number,
        tp: number
    ): Tile {
        return new Tile(
            owner,
            loc,
            rsrc,
            genRandomSalt() as bigint,
            cityId,
            interval,
            tp
        );
    }

    /*
     * Unowned water tile. Players can move troops onto water tiles
     */
    static water(l: Location, r: bigint): Tile {
        return new Tile(
            Tile.UNOWNED,
            l,
            0,
            this.proceduralSalt(l, r),
            0,
            0,
            this.WATER_TILE
        );
    }

    static spawn(pl: Player, l: Location, r: number, cityId: number): Tile {
        return Tile.genOwned(pl, l, r, cityId, 0, Tile.CITY_TILE);
    }
}
