// @ts-ignore
import { buildPoseidon } from "circomlibjs";
// @ts-ignore
import { TextEncoder } from "text-encoding-utf-8";
import { genRandomSalt } from "maci-crypto";
import { Utils } from "./Utils";
import { Player } from "./Player";
import { Tile, Location } from "./Tile";

export class Board {
  static PERIMETER: number[][] = [-1, 0, 1].flatMap((x) =>
    [-1, 0, 1].map((y) => [x, y])
  );

  t: Tile[][];
  poseidon: any;
  utf8Encoder: any;

  public constructor() {
    this.utf8Encoder = new TextEncoder();
    this.t = new Array<Array<Tile>>();
  }

  /*
   * Set up member variables that involve async. Cannot do in constructor.
   * Must call before using any other Board functions.
   */
  public async setup() {
    this.poseidon = await buildPoseidon();
  }

  /*
   * Seed game board by sampling access key for each tile, updating on-chain
   * merkle tree along the way. Doesn't do any sampling if isInit flag is off.
   * With that setting, it only initializes board with mystery tiles.
   */
  public async seed(sz: number, isInit: boolean, nStates: any) {
    for (let i = 0; i < sz; i++) {
      let row: Tile[] = new Array<Tile>();
      for (let j = 0; j < sz; j++) {
        if (isInit) {
          let tl: Tile = Tile.genUnowned({ r: i, c: j });
          await nStates.set(tl.hash(this.utf8Encoder, this.poseidon));
          await Utils.sleep(200);
          row.push(tl);
        } else {
          row.push(Tile.mystery({ r: i, c: j }));
        }
      }
      this.t.push(row);
    }
  }

  /*
   * Check if a location = (row, col) pair is within the bounds of the board.
   */
  private inBounds(r: number, c: number): boolean {
    return r < this.t.length && r >= 0 && c < this.t[0].length && c >= 0;
  }

  /*
   * Throws an error if a presented location isn't in bounds.
   */
  private assertBounds(l: Location) {
    if (!this.inBounds(l.r, l.c)) {
      throw new Error("Tried to edit tile out of bounds.");
    }
  }

  /*
   * Spawn Player at a Location. Used for development.
   */
  public spawn(l: Location, pl: Player, resource: number) {
    this.assertBounds(l);

    let r = l.r,
      c = l.c;
    if (this.t[r][c].owner != Tile.UNOWNED) {
      throw new Error("Tried to spawn player on an owned tile.");
    }
    this.t[r][c] = Tile.genOwned(pl, { r: r, c: c }, resource);
  }

  /*
   * Displays colored gameboard.
   */
  public printView(): void {
    for (let i = 0; i < this.t.length; i++) {
      for (let j = 0; j < this.t[0].length; j++) {
        let tl: Tile = this.getTile({ r: i, c: j });
        let color;
        const reset = "\x1b[0m";
        if (tl.owner.symbol === "A") {
          color = "\x1b[32m";
        } else if (tl.owner.symbol === "B") {
          color = "\x1b[31m";
        } else if (tl.owner.symbol === "C") {
          color = "\x1b[44m";
        } else {
          color = "\x1b[37m";
        }
        process.stdout.write(color + `[${tl.owner.symbol}]` + reset);
      }
      process.stdout.write("\n");
    }
    process.stdout.write("---\n");
  }

  /*
   * Getter for Tile at a location.
   */
  public getTile(l: Location): Tile {
    this.assertBounds(l);
    return this.t[l.r][l.c];
  }

  /*
   * Set location to new Tile value.
   */
  public setTile(tl: Tile) {
    this.t[tl.loc.r][tl.loc.c] = tl;
  }

  /*
   * Check if a location is in the FoW for player.
   */
  public inFog(l: Location, symbol: string): boolean {
    let r = l.r,
      c = l.c;
    let foundNeighbor = false;
    Board.PERIMETER.forEach(([dy, dx]) => {
      let nr = r + dy,
        nc = c + dx;
      if (this.inBounds(nr, nc) && this.t[nr][nc].owner.symbol === symbol) {
        foundNeighbor = true;
      }
    });
    return !foundNeighbor;
  }

  /*
   * Returns true if every Tile in this board instance is a Mystery. Only
   * happens when not player isn't spawned yet.
   */
  public noVisibility() {
    for (let i = 0; i < this.t.length; i++) {
      for (let j = 0; j < this.t[0].length; j++) {
        const tl: Tile = this.getTile({ r: i, c: j });
        if (!tl.isMystery()) {
          return false;
        }
      }
    }
    return true;
  }
}
