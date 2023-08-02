import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";
import Utils from "../enclave/utils";

const PORT: number = 3000;
const GRID_SIZE: number = 5;

let viewGrid: Array<Array<string>> = [[]];

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  `http://localhost:3000`
);

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function printPlayerView() {
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      process.stdout.write(viewGrid[i][j] + " ");
    }
    process.stdout.write("\n");
  }
}

function updatePlayerView() {
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      socket.emit("decrypt", i, j, "A");
    }
  }
  sleep(1000).then(() => {
    printPlayerView();
  });
}

socket.on("connect", () => {
  console.log("Server connection established");
  viewGrid = new Array(GRID_SIZE)
    .fill(false)
    .map(() => new Array(GRID_SIZE).fill("(?, 0, 0x00)"));

  updatePlayerView();
});

socket.on(
  "decryptResponse",
  (
    r: number,
    c: number,
    symbol: string,
    resource: number,
    key: string
  ) => {
    viewGrid[r][c] = `(${symbol}, ${resource}, 0x${key.slice(0, 2)})`
  }
);
