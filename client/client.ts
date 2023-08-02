import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";
import Utils from "../enclave/utils";

const PORT: number = 3000;
const GRID_SIZE: number = 5;

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  `http://localhost:3000`
);

function logPlayerView() {
    for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
            socket.emit("decrypt", i, j, "A");
        }
    }
}

socket.on("connect", () => {
  console.log("Connected to the server!");
  logPlayerView()
});

socket.on(
  "decryptResponse",
  (r: number, c: number, symbol: string, resource: number, key: typeof Utils.FQ) => {
    console.log("decryptResponse", r, c, symbol, resource, key);
  }
);
