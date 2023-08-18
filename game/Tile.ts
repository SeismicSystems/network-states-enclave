import { Player } from "./Player";
import { FQType, Utils } from "./Utils";

export type Location = {
  r: number;
  c: number;
};

export class Tile {
  owner: Player;
  loc: Location;
  resources: number;
  key: FQType;

  constructor(o_: Player, l_: Location, r_: number, k_: FQType) {
    this.owner = o_;
    this.loc = l_;
    this.resources = r_;
    this.key = k_;
  }

  /*
   * Compute hash of this Tile. 
   */
  hash(utf8Encoder: any, poseidon: any): FQType {
    return Utils.strToFQ(
      poseidon.F.toString(poseidon(this.flatDec(utf8Encoder)), 10)
    );
  }

  /*
   * Compute the nullifier, defined as the hash of access key. 
   */
  nullifier(poseidon: any): FQType {
    return Utils.strToFQ(
      poseidon.F.toString(poseidon([Utils.FQToStr(this.key)]), 10)
    );
  }

  /*
   * TEMPORARY WHILE PLAYER STILL REPRESENTED BY SYMBOL. replace with 
   * Object.values(jsonRepr) once player represented by public key
   */
  flatDec(utf8Encoder: any): string[] {
    let ownerEncoding: number = utf8Encoder
      .encode(this.owner.symbol)
      .reduce((acc: number, byte: number) => acc + byte.toString(10), "");
    return [
      BigInt(ownerEncoding).toString(10),
      this.loc.r.toString(),
      this.loc.c.toString(),
      this.resources.toString(),
      Utils.FQToStr(this.key),
    ];
  }

  /*
   * Convert to JSON object where all values are strings. 
   */
  toJSON(): object {
    return {
      owner: this.owner.symbol,
      r: this.loc.r.toString(),
      c: this.loc.c.toString(),
      resources: this.resources.toString(),
      key: Utils.FQToStr(this.key),
    };
  }

  /*
   * Convert JSON object to tile. 
   */
  static fromJSON(obj: any): Tile {
    return new Tile(
      new Player(obj.owner),
      { r: parseInt(obj.r, 10), c: parseInt(obj.c, 10) },
      parseInt(obj.resources, 10),
      Utils.strToFQ(obj.key)
    );
  }
}
