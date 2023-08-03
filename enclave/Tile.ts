import Player from "./Player";
import Utils from "./utils";
import { Location } from "./types";

export default class Tile {
  owner: Player;
  loc: Location;
  resources: number;
  key: typeof Utils.FQ;

  constructor(o_: Player, l_: Location, r_: number, k_: typeof Utils.FQ) {
    this.owner = o_;
    this.loc = l_;
    this.resources = r_;
    this.key = k_;
  }

  hexify(utf8Encoder: any): string[] {
    let ownerEncoding: number = utf8Encoder
      .encode(this.owner.symbol)
      .reduce((acc: number, byte: number) => acc + byte.toString(10), "");
    let ownerHex = "0x" + BigInt(ownerEncoding).toString(16);
    return [
      ownerHex,
      Utils.numToHexStr(this.loc.r),
      Utils.numToHexStr(this.loc.c),
      Utils.numToHexStr(this.resources),
      Utils.FQToStr(this.key),
    ];
  }

  hash(utf8Encoder: any, poseidon: any): typeof Utils.FQ {
    return Utils.strToFQ(
      "0x" + poseidon.F.toString(poseidon(this.hexify(utf8Encoder)), 16)
    );
  }

  nullifier(poseidon: any): typeof Utils.FQ {
    return Utils.strToFQ(
      "0x" + poseidon.F.toString(poseidon([Utils.FQToStr(this.key)]), 16)
    );
  }

  toString(): string {
    const truncKey = this.key[0];
    return `(${this.owner.toString()}, ${this.resources}, ${truncKey})`;
  }

  toJSON(): object {
    return {
      owner: this.owner.symbol,
      r: this.loc.r,
      c: this.loc.c,
      resources: this.resources,
      key: Utils.FQToStr(this.key),
    };
  }

  static fromJSON(obj: any): Tile {
    return new Tile(
      new Player(obj.owner),
      { r: obj.r, c: obj.c },
      obj.resources,
      Utils.strToFQ(obj.key)
    );
  }
}
