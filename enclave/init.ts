const randbigint = require("random-bigint");

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
  key: BigInt;

  constructor(o_: Player, r_: number, k_: BigInt) {
    this.owner = o_;
    this.resources = r_;
    this.key = k_;
  }

  toString(): string {
    const truncKey = this.key.toString()[0];
    return `(${this.owner.toString()}, ${this.resources}, ${truncKey})`;
  }
}

class Grid {
  t: Tile[][];

  constructor(sz: number, unowned: Player) {
    this.t = new Array<Array<Tile>>();
    for (let i = 0; i < sz; i++) {
      let row: Tile[] = new Array<Tile>();
      for (let j = 0; j < sz; j++) {
        row.push(new Tile(unowned, 0, randbigint(256)));
      }
      this.t.push(row);
    }
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

(async () => {
  const g = new Grid(GRID_SIZE, UNOWNED);
  console.log(g.toString());
  process.exit(0);
})();
