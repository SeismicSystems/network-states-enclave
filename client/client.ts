import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";
import Utils from "../enclave/utils";
import Tile from "../enclave/Tile";
import Player from "../enclave/Player";
import Grid from "../enclave/Grid";
import { Location } from "../enclave/types";

const PORT: number = 3000;
const GRID_SIZE: number = 5;

let g = new Grid(GRID_SIZE, false);

let viewGrid: Array<Array<string>> = [[]];

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  `http://localhost:${PORT}`
);

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function updatePlayerView() {
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      socket.emit("decrypt", { r: i, c: j }, "A");
    }
  }
}

function move() {
  let tFrom: Tile = g.getTile({ r: 0, c: 0 });
  let tTo: Tile = g.getTile({ r: 0, c: 1 });
  let uFrom: Tile = new Tile(tFrom.owner, tFrom.loc, 1, Utils.randFQStr());
  let uTo: Tile = new Tile(
    tFrom.owner,
    tTo.loc,
    tTo.resources + tFrom.resources - 1,
    Utils.randFQStr()
  );
  socket.emit("move", tFrom, tTo, uFrom, uTo);
}

socket.on("connect", async () => {
  console.log("Server connection established");

  updatePlayerView();
  await sleep(1000);
  g.printView();

  move();
  await sleep(1000);
  updatePlayerView();
  await sleep(1000);
  g.printView();
});

socket.on("decryptResponse", (t: Tile) => {
  g.setTile(t);
});
