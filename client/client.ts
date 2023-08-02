import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";
import Utils from "../enclave/utils";
import Tile from "../enclave/Tile";
import Player from "../enclave/Player";
import Grid from "../enclave/Grid";
import { Location } from "../enclave/types";
import readline from "readline";

const PORT: number = 3000;
const GRID_SIZE: number = 5;
const UPDATE_MLS: number = 1000;

const PLAYER_SYMBOL: string = process.argv[2];
const PLAYER_START: Location = {
  r: Number(process.argv[3]),
  c: Number(process.argv[4]),
};
const MOVE_KEYS: Record<string, number[]> = {
  w: [-1, 0],
  a: [0, -1],
  s: [1, 0],
  d: [0, 1],
};

let g = new Grid(GRID_SIZE, false);
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
let cursor = PLAYER_START;

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  `http://localhost:${PORT}`
);

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function updatePlayerView() {
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      socket.emit("decrypt", { r: i, c: j }, PLAYER_SYMBOL);
    }
  }
}

function move(inp: string) {
  let nr = cursor.r + MOVE_KEYS[inp][0],
    nc = cursor.c + MOVE_KEYS[inp][1];

  let tFrom: Tile = g.getTile(cursor);
  let tTo: Tile = g.getTile({ r: nr, c: nc });
  let uFrom: Tile = new Tile(tFrom.owner, tFrom.loc, 1, Utils.randFQStr());
  let uTo: Tile;
  if (tTo.owner === tFrom.owner) {
    uTo = new Tile(
      tTo.owner,
      tTo.loc,
      tTo.resources + tFrom.resources - 1,
      Utils.randFQStr()
    );
  } else {
    uTo = new Tile(
      tTo.owner,
      tTo.loc,
      tTo.resources - tFrom.resources + 1,
      Utils.randFQStr()
    );
    if (uTo.resources < 0) {
      uTo.owner = uFrom.owner;
      uTo.resources *= -1;
    }
  }

  socket.emit("move", tFrom, tTo, uFrom, uTo);

  cursor = { r: nr, c: nc };
}

async function gameLoop() {
  rl.question("Next move: ", async (ans) => {
    move(ans);
    await sleep(UPDATE_MLS);
    updatePlayerView();
    await sleep(UPDATE_MLS);
    g.printView();
    gameLoop();
  });
}

socket.on("connect", async () => {
  console.log("Server connection established");
  updatePlayerView();
  await sleep(UPDATE_MLS);
  g.printView();
  gameLoop();
});

socket.on("decryptResponse", (t: Tile) => {
  g.setTile(t);
});
