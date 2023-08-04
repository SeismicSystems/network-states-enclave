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

import { ethers } from "ethers";

// @ts-ignore
import { buildPoseidon } from "circomlibjs";
// @ts-ignore
import { TextEncoder } from "text-encoding-utf-8";

const CONTRACT_ADDR: string = "0x532802f2F9E0e3EE9d5Ba70C35E1F43C0498772D";
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

// Anvil defaults
const signer = new ethers.Wallet(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545")
);
const nStates = new ethers.Contract(
  CONTRACT_ADDR,
  require("../contracts/out/NStates.sol/NStates.json").abi,
  signer
);

let g: Grid;
let poseidon, utf8Encoder;

io.on("connection", (socket: Socket) => {
  console.log("Client connected: ", socket.id);

  socket.on("move", (tFrom: any, tTo: any, uFrom: any, uTo: any) => {
    g.setTile(Tile.fromJSON(uFrom));
    g.setTile(Tile.fromJSON(uTo));
    io.sockets.emit("update");
  });

  socket.on("decrypt", (l: Location, symbol: string) => {
    if (g.inFog(l, symbol)) {
      let mysteryTile = new Tile(g.mystery, l, 0, Utils.zeroFQ());
      socket.emit("decryptResponse", mysteryTile.toJSON());
      return;
    }
    socket.emit("decryptResponse", g.getTile(l).toJSON());
  });
});

function spawnPlayers() {
  g.spawn({ r: 0, c: 0 }, PLAYER_A, START_RESOURCES);
  g.spawn({ r: 0, c: GRID_SIZE - 1 }, PLAYER_B, START_RESOURCES);
  g.spawn({ r: GRID_SIZE - 1, c: 0 }, PLAYER_C, START_RESOURCES);
}

server.listen(PORT, async () => {
  poseidon = await buildPoseidon();
  utf8Encoder = new TextEncoder();

  g = new Grid(poseidon, utf8Encoder);
  await g.seed(GRID_SIZE, true, nStates)
  spawnPlayers();

  console.log(`Server running on http://localhost:${PORT}`);
});
