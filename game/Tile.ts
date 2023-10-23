// @ts-ignore
import { PubKey } from "maci-domainobjs";
import { genRandomSalt } from "maci-crypto";
import { Player } from "./Player";
/*
 * poseidonPerm is a modified version of iden3's poseidonPerm.js.
 */
const poseidonPerm = require("./poseidonPerm");

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
        return poseidonPerm([
            BigInt(0),
            ...this.toCircuitInput().map((e) => BigInt(e)),
        ])[0].toString();
    }

    /*
     * Compute the nullifier, defined as the hash of access key. Returns decimal
     * string representation.
     */
    nullifier(): string {
        return poseidonPerm([BigInt(0), this.key])[0].toString();
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
    isCityCenter(): boolean {
        return this.tileType === Tile.CITY_TILE;
    }

    /*
     * Return true if this Tile is a capital.
     */
    isCapital(): boolean {
        return this.tileType === Tile.CAPITAL_TILE;
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
