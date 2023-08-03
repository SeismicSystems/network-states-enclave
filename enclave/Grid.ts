import Utils from "./utils";
import Player from "./Player";
import Tile from "./Tile";
import { Location } from "./types";

export default class Grid {
  t: Tile[][];
  poseidon: any;
  utf8Encoder: any;
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
  unowned: Player = new Player("_");
  mystery: Player = new Player("?");

  constructor(poseidon_: any, utf8Encoder_: any) {
    this.poseidon = poseidon_;
    this.utf8Encoder = utf8Encoder_;
    this.t = new Array<Array<Tile>>();
  }

  async seed(sz: number, isInit: boolean, nStates: any) {
    for (let i = 0; i < sz; i++) {
      let row: Tile[] = new Array<Tile>();
      for (let j = 0; j < sz; j++) {
        if (isInit) {
          let tl: Tile = new Tile(
            this.unowned,
            { r: i, c: j },
            0,
            Utils.randFQ()
          );
          await nStates.set(
            Utils.FQToStr(tl.hash(this.utf8Encoder, this.poseidon))
          );
          await Utils.sleep(200);
          row.push(tl);
        } else {
          row.push(new Tile(this.mystery, { r: i, c: j }, 0, Utils.zeroFQ()));
        }
      }
      this.t.push(row);
    }
  }

  inBounds(r: number, c: number): boolean {
    return r < this.t.length && r >= 0 && c < this.t[0].length && c >= 0;
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
    this.t[r][c] = new Tile(pl, { r: r, c: c }, resource, Utils.randFQ());
  }

  printView(): void {
    for (let i = 0; i < this.t.length; i++) {
      for (let j = 0; j < this.t[0].length; j++) {
        let tl: Tile = this.getTile({ r: i, c: j });
        process.stdout.write(
          `(${tl.owner.symbol}, ${tl.resources}, ${Utils.FQToStr(tl.key).slice(
            0,
            3
          )})`
        );
      }
      process.stdout.write("\n");
    }
    process.stdout.write("---\n");
  }

  getTile(l: Location): Tile {
    this.assertBounds(l);
    return this.t[l.r][l.c];
  }

  setTile(tl: Tile) {
    this.t[tl.loc.r][tl.loc.c] = tl;
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

  move(from: Location, to: Location, resource: number) {
    this.t[from.r][from.c].resources -= resource;
    this.t[to.r][to.c].resources += resource;
  }
}
