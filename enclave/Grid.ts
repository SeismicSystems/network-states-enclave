import Utils from "./utils";
import Player from "./Player";
import Tile from "./Tile";

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
    return r < this.t.length && r >= 0 && c < this.t[0].length && c >= 0;
  }

  assertBounds(r: number, c: number) {
    if (!this.inBounds(r, c)) {
      throw new Error("Tried to edit tile out of bounds.");
    }
  }

  spawn(r: number, c: number, pl: Player, resource: number) {
    this.assertBounds(r, c);

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

  getTile(r: number, c: number): Tile {
    this.assertBounds(r, c);
    return this.t[r][c];
  }

  inFog(r: number, c: number, symbol: string): boolean {
    let foundNeighbor = false;
    this.around.forEach(([dy, dx]) => {
      let nr = r + dy, nc = c + dx;
      if (this.inBounds(nr, nc) && this.t[nr][nc].owner.symbol === symbol) {
        foundNeighbor = true;
      }
    }) 
    return !foundNeighbor;
  }
}
