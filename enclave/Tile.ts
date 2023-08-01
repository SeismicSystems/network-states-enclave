import Player from "./Player";
import Utils from "./utils";

export default class Tile {
  owner: Player;
  resources: number;
  key: typeof Utils.FQ;

  constructor(o_: Player, r_: number, k_: BigInt) {
    this.owner = o_;
    this.resources = r_;
    this.key = k_;
  }

  toString(): string {
    const truncKey = this.key.n.toString(16)[0];
    return `(${this.owner.toString()}, ${this.resources}, ${truncKey})`;
  }
}
