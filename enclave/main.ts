import Player from "./Player";
import Grid from "./Grid";

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
