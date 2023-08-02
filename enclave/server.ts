import Player from "./Player";
import Grid from "./Grid";
import { Location } from "./types";

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

  socket.on("decrypt", (l: Location, symbol: string) => {
    if (g.inFog(l, symbol)) {
      socket.emit("decryptResponse", l, "?", 0, "00");
      return;
    }

    let t = g.getTile(l);
    socket.emit(
      "decryptResponse",
      l,
      t.owner.symbol,
      t.resources,
      t.key.n.toString(16)
    );
  });
});

function spawnPlayers() {
  g.spawn({ r: 0, c: 0 }, PLAYER_A, START_RESOURCES);
  g.spawn({ r: 0, c: GRID_SIZE - 1 }, PLAYER_B, START_RESOURCES);
  g.spawn({ r: GRID_SIZE - 1, c: 0 }, PLAYER_C, START_RESOURCES);
}

server.listen(PORT, () => {
  spawnPlayers();
  console.log(`Server running on http://localhost:${PORT}`);
});
