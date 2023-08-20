// @ts-ignore
import { buildPoseidon } from "circomlibjs";
// @ts-ignore
import { TextEncoder } from "text-encoding-utf-8";
import { Utils } from "./Utils";
import { Player } from "./Player";
import { Tile, Location } from "./Tile";

export class Board {
  static PERIMETER: number[][] = [-1, 0, 1].flatMap((x) =>
    [-1, 0, 1].map((y) => [x, y])
  );
  static UNOWNED: Player = new Player("_");
  static MYSTERY: Player = new Player("?");

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
          let tl: Tile = new Tile(
            Board.UNOWNED,
            { r: i, c: j },
            0,
            Utils.randFQ()
          );
          await nStates.set(
            Utils.FQToStr(tl.hash(this.utf8Encoder, this.poseidon))
          );
          await Utils.sleep(50);
          row.push(tl);
        } else {
          row.push(new Tile(Board.MYSTERY, { r: i, c: j }, 0, Utils.zeroFQ()));
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
   * Spawn a player at a location. 
   */
  public spawn(l: Location, pl: Player, resource: number) {
    this.assertBounds(l);

    let r = l.r,
      c = l.c;
    if (this.t[r][c].owner != Board.UNOWNED) {
      throw new Error("Tried to spawn player on an owned tile.");
    }
    this.t[r][c] = new Tile(pl, { r: r, c: c }, resource, Utils.randFQ());
  }

  /*
   * Displays colored gameboard. 
   */
  public printView(): void {
    for (let i = 0; i < this.t.length; i++) {
      for (let j = 0; j < this.t[0].length; j++) {
        let tl: Tile = this.getTile({ r: i, c: j });
        process.stdout.write(`[${tl.owner.pubkey}]`);
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
  inFog(l: Location, symbol: string): boolean {
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
}
