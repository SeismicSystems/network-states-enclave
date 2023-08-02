import Player from "./Player";
import Utils from "./utils";
import { Location } from "./types";

export default class Tile {
  owner: Player;
  loc: Location;
  resources: number;
  key: string;

  constructor(o_: Player, l_: Location, r_: number, k_: string) {
    this.owner = o_;
    this.loc = l_;
    this.resources = r_;
    this.key = k_;
  }

  toString(): string {
    const truncKey = this.key[0];
    return `(${this.owner.toString()}, ${this.resources}, ${truncKey})`;
  }
}
