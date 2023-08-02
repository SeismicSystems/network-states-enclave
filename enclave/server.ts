import Player from "./Player";
import Grid from "./Grid";

import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "./socket";

const PORT: number = 3000;

const GRID_SIZE: number = 5;
const START_RESOURCES: number = 9;

const UNOWNED: Player = new Player("_");
const PLAYER_A: Player = new Player("A");
const PLAYER_B: Player = new Player("B");
const PLAYER_C: Player = new Player("C");

const app = express();
const server = http.createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server);

const g = new Grid(GRID_SIZE, UNOWNED);

io.on("connection", (socket: Socket) => {
  console.log("Client connected: ", socket.id);

  socket.on("move", () => {
    console.log("LOGGED A MOVE");
  });

  socket.on("decrypt", (r: number, c: number, symbol: string) => {
    if (g.inFog(r, c, symbol)) {
      socket.emit("decryptResponse", r, c, "?", 0, "00");
      return;
    } 

    let t = g.getTile(r, c);
    socket.emit("decryptResponse", r, c, t.owner.symbol, t.resources, t.key.n.toString(16));
  });
});

function spawnPlayers() {
  g.spawn(0, 0, PLAYER_A, START_RESOURCES);
  g.spawn(0, GRID_SIZE - 1, PLAYER_B, START_RESOURCES);
  g.spawn(GRID_SIZE - 1, 0, PLAYER_C, START_RESOURCES);
}

server.listen(PORT, () => {
  spawnPlayers();
  console.log(`Server running on http://localhost:${PORT}`);
});
