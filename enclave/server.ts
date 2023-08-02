import Player from "./Player";
import Tile from "./Tile";
import Grid from "./Grid";
import Utils from "./utils";
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

const g = new Grid(GRID_SIZE, true);

io.on("connection", (socket: Socket) => {
  console.log("Client connected: ", socket.id);

  socket.on("move", (tFrom: Tile, tTo: Tile, uFrom: Tile, uTo: Tile) => {
    g.setTile(uFrom);
    g.setTile(uTo);
  });

  socket.on("decrypt", (l: Location, symbol: string) => {
    if (g.inFog(l, symbol)) {
      socket.emit(
        "decryptResponse",
        new Tile(g.mystery, l, 0, Utils.zeroFQStr())
      );
      return;
    }

    socket.emit("decryptResponse", g.getTile(l));
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
