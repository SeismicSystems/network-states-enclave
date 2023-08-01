
import Utils from "./utils";

class Player {
  symbol: string;

  constructor(s_: string) {
    this.symbol = s_;
  }

  toString(): string {
    return `${this.symbol}`;
  }
}

class Tile {
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

class Grid {
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
    if(r >= this.t.length || r < 0 || c >= this.t[0].length || r < 0) {
      throw new Error("Tried to spawn player out of bounds.")
    }
    if(this.t[r][c].owner != this.unowned) {
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

const GRID_SIZE: number = 5;
const START_RESOURCES: number = 9;

const UNOWNED: Player = new Player("_");
const PLAYER_A: Player = new Player("A");
const PLAYER_B: Player = new Player("B");
const PLAYER_C: Player = new Player("C");

(async () => {
  const g = new Grid(GRID_SIZE, UNOWNED);
  
  g.spawn(0, 0, PLAYER_A, START_RESOURCES);
  g.spawn(0, GRID_SIZE - 1, PLAYER_B, START_RESOURCES);
  g.spawn(GRID_SIZE - 1, 0, PLAYER_C, START_RESOURCES);

  console.log(g.toString());
  process.exit(0);
})();
