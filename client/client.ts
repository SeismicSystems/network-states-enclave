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

function updatePlayerView() {
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      socket.emit("decrypt", { r: i, c: j }, "A");
    }
  }
  sleep(1000).then(() => {
    g.printView();
  });
}

socket.on("connect", () => {
  console.log("Server connection established");
  updatePlayerView();
  //   tFrom: Tile, tTo: Tile, uFrom: Tile, uTo: Tile
  //   let tFrom: Tile = { owner: { symbol: "A" }, loc: {r: 0, c: 0}, resources: 9,  };
  //   socket.emit("move", );loc: {}
//   sleep(2000).then(() => {
//     updatePlayerView();
//   });
});

socket.on("decryptResponse", (t: Tile) => {
  g.setTile(t);
});
