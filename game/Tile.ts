// @ts-ignore
import { poseidon } from "circomlib";
import { PubKey } from "maci-domainobjs";
import { genRandomSalt } from "maci-crypto";
import { Player } from "./Player";

export type Location = {
    r: number;
    c: number;
};

export class Tile {
    static UNOWNED: Player = new Player("_");
    static MYSTERY: Player = new Player("?");

    // If cityId = 0 then the tile is considered unowned
    static UNOWNED_ID: number = 0;

    // tileType options
    static NORMAL_TILE: number = 0;
    static CITY_TILE: number = 1;
    static CAPITAL_TILE: number = 2;
    static WATER_TILE: number = 3;
    static HILL_TILE: number = 4;

    owner: Player;
    loc: Location;
    resources: number;
    key: BigInt;
    cityId: number;
    latestUpdateInterval: number;
    tileType: number;

    constructor(
        o_: Player,
        l_: Location,
        r_: number,
        k_: BigInt,
        c_: number,
        i_: number,
        t_: number
    ) {
        this.owner = o_;
        this.loc = l_;
        this.resources = r_;
        this.key = k_;
        this.cityId = c_;
        this.latestUpdateInterval = i_;
        this.tileType = t_;
    }

    /*
     * Represent Tile as an array of BigInt values to pass into the circuit.
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
        const hash1 = poseidon([
            BigInt(this.loc.r.toString()),
            BigInt(this.loc.c.toString()),
            BigInt(this.tileType.toString()),
        ]);
        const hash2 = poseidon([
            BigInt(this.resources.toString()),
            BigInt(this.key.toString()),
            BigInt(this.cityId.toString()),
            BigInt(this.latestUpdateInterval.toString()),
        ]);

        return poseidon([
            BigInt(hash1.toString()),
            BigInt(hash2.toString()),
        ]).toString();
    }

    /*
     * Compute the nullifier, defined as the hash of access key. Returns decimal
     * string representation.
     */
    nullifier(): string {
        return poseidon([this.key]).toString();
    }

    /*
     * Returns the owner's public key as a string.
     */
    ownerPubKey(): string {
        return this.owner.bjjPub.serialize();
    }

    /*
     * Convert to JSON object with all values as strings.
     */
    toJSON(): object {
        return {
            symbol: this.owner.symbol,
            bjjPub: this.owner.bjjPub.serialize(),
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
     * Return true if this Tile is a city.
     */
    isCity(): boolean {
        return this.tileType === Tile.CITY_TILE;
    }

    /*
     * Return true if this Tile is a capital.
     */
    isCapital(): boolean {
        return this.tileType === Tile.CAPITAL_TILE;
    }

    /*
     * Returns string representation of tile state.
     */
    stringify(): string {
        return this.toCircuitInput().toString();
    }

    /*
     * Converts a stringified Tile back into its native type, or return
     * undefined if the string is improperly formatted.
     */
    static unStringifyTile(symbol: string, owner: string, s: string) {
        const split = s.split(",");
        if (split[3] == undefined) {
            return undefined;
        }
        const r = Number(split[0]);
        const c = Number(split[1]);
        const rsrc = Number(split[2]);
        const key = BigInt(split[3]);
        const cityId = Number(split[4]);
        const interval = Number(split[5]);
        const type = Number(split[6]);

        if (
            split.length != 7 ||
            isNaN(r) ||
            isNaN(c) ||
            isNaN(rsrc) ||
            isNaN(cityId) ||
            isNaN(interval) ||
            isNaN(type)
        ) {
            return undefined;
        }
        const player = Player.fromPubString(symbol, owner);
        return new Tile(player, { r, c }, rsrc, key, cityId, interval, type);
    }

    /*
     * Converts a Location type into its (unique) string representation.
     */
    static stringifyLocation(l: Location): string {
        return JSON.stringify(l);
    }

    /*
     * Convert JSON object to Tile.
     */
    static fromJSON(obj: any): Tile {
        return new Tile(
            new Player(obj.symbol, undefined, PubKey.unserialize(obj.bjjPub)),
            { r: parseInt(obj.r, 10), c: parseInt(obj.c, 10) },
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
        return new Tile(Tile.MYSTERY, l, 0, BigInt(0), 0, 0, this.NORMAL_TILE);
    }

    /*
     * Hill tile. Players cannot move onto a hill tile.
     */
    static hill(l: Location): Tile {
        return new Tile(
            Tile.UNOWNED,
            l,
            0,
            genRandomSalt(),
            0,
            0,
            this.HILL_TILE
        );
    }

    /*
     * New unowned tile with random salt as the access key.
     */
    static genUnowned(l: Location): Tile {
        return new Tile(
            Tile.UNOWNED,
            l,
            0,
            genRandomSalt(),
            0,
            0,
            this.NORMAL_TILE
        );
    }

    /*
     * New owned tile with random salt as the access key.
     */
    static genOwned(
        o_: Player,
        l_: Location,
        r_: number,
        c_: number,
        i_: number,
        t_: number
    ): Tile {
        return new Tile(o_, l_, r_, genRandomSalt(), c_, i_, t_);
    }

    /*
     * Unowned water tile. Players can move troops onto water tiles
     */
    static water(l_: Location): Tile {
        return new Tile(
            Tile.UNOWNED,
            l_,
            0,
            genRandomSalt(),
            0,
            0,
            this.WATER_TILE
        );
    }
}
