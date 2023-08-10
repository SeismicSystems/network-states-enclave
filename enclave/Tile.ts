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

  // [TODO] merge this with toJSON()
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

  hash(utf8Encoder: any, poseidon: any): typeof Utils.FQ {
    return Utils.strToFQ(
      poseidon.F.toString(poseidon(this.flatDec(utf8Encoder)), 10)
    );
  }

  nullifier(poseidon: any): typeof Utils.FQ {
    return Utils.strToFQ(
      poseidon.F.toString(poseidon([Utils.FQToStr(this.key)]), 10)
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
