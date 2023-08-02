import Utils from "./utils";
import Player from "./Player";
import Tile from "./Tile";
import { Location } from "./types";

export default class Grid {
  t: Tile[][];
  unowned: Player;
  around = [
    [0, 0],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, 0],
    [1, -1],
  ];

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

  inBounds(r: number, c: number): boolean {
    return (
      r < this.t.length && r >= 0 && c < this.t[0].length && c >= 0
    );
  }

  assertBounds(l: Location) {
    if (!this.inBounds(l.r, l.c)) {
      throw new Error("Tried to edit tile out of bounds.");
    }
  }

  spawn(l: Location, pl: Player, resource: number) {
    this.assertBounds(l);

    let r = l.r,
      c = l.c;
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

  getTile(l: Location): Tile {
    this.assertBounds(l);
    return this.t[l.r][l.c];
  }

  inFog(l: Location, symbol: string): boolean {
    let r = l.r,
      c = l.c;
    let foundNeighbor = false;
    this.around.forEach(([dy, dx]) => {
      let nr = r + dy,
        nc = c + dx;
      if (this.inBounds(nr, nc) && this.t[nr][nc].owner.symbol === symbol) {
        foundNeighbor = true;
      }
    });
    return !foundNeighbor;
  }
}
