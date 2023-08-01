import Utils from "./utils";
import Player from "./Player";
import Tile from "./Tile";

export default class Grid {
  t: Tile[][];
  unowned: Player;

  constructor(sz: number, unowned: Player) {
    this.t = new Array<Array<Tile>>();
    for (let i = 0; i < sz; i++) {
      let row: Tile[] = new Array<Tile>();
      for (let j = 0; j < sz; j++) {
        row.push(new Tile(unowned, 0, Utils.randFQ()));
      }
      this.t.push(row);
    }
    this.unowned = unowned;
  }

  spawn(r: number, c: number, pl: Player, resource: number) {
    if (r >= this.t.length || r < 0 || c >= this.t[0].length || r < 0) {
      throw new Error("Tried to spawn player out of bounds.");
    }
    if (this.t[r][c].owner != this.unowned) {
      throw new Error("Tried to spawn player on an owned tile.");
    }
    this.t[r][c] = new Tile(pl, resource, Utils.randFQ());
  }

  toString(): string {
    return this.t
      .map((row) => row.map((tile) => tile.toString()).join(" "))
      .join("\n");
  }
}
