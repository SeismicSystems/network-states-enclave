import { PubKey } from "maci-domainobjs";
import { genRandomSalt, hashOne, hash5 } from "maci-crypto";
import { Player } from "./Player";

export type Location = {
  r: number;
  c: number;
};

export class Tile {
  static UNOWNED: Player = new Player("_");
  static MYSTERY: Player = new Player("?");

  owner: Player;
  loc: Location;
  resources: number;
  key: BigInt;

  constructor(o_: Player, l_: Location, r_: number, k_: BigInt) {
    this.owner = o_;
    this.loc = l_;
    this.resources = r_;
    this.key = k_;
  }

  /*
   * Compute hash of this Tile and convert it into a decimal string.
   */
  hash(): string {
    return hash5([
      this.owner.bjjPub.hash(),
      BigInt(this.loc.r),
      BigInt(this.loc.c),
      BigInt(this.resources),
      this.key,
    ]).toString();
  }

  /*
   * Compute the nullifier, defined as the hash of access key. Returns decimal
   * string representation.
   */
  nullifier(): string {
    return hashOne(this.key).toString();
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
    };
  }

  /*
   * Return true if this Tile is in the fog for the current player view.
   */
  isMystery(): boolean {
    return this.owner.symbol === Tile.MYSTERY.symbol;
  }

  /*
   * Convert JSON object to Tile.
   */
  static fromJSON(obj: any): Tile {
    return new Tile(
      new Player(obj.symbol, undefined, PubKey.unserialize(obj.bjjPub)),
      { r: parseInt(obj.r, 10), c: parseInt(obj.c, 10) },
      parseInt(obj.resources, 10),
      BigInt(obj.key)
    );
  }

  /*
   * Meant to represent a tile in the fog of war.
   */
  static mystery(l: Location): Tile {
    return new Tile(Tile.MYSTERY, l, 0, BigInt(0));
  }

  /*
   * New unowned tile with random salt as the access key.
   */
  static genUnowned(l: Location): Tile {
    return new Tile(Tile.UNOWNED, l, 0, genRandomSalt());
  }

  /*
   * New owned tile with random salt as the access key.
   */
  static genOwned(o_: Player, l_: Location, r_: number): Tile {
    return new Tile(o_, l_, r_, genRandomSalt());
  }
}
