import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { ethers } from "ethers";
import dotenv from "dotenv";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "./socket";
import { Tile, Player, Grid, Location, Utils } from "../game";

/*
 * Set game parameters and define default players.
 */
const GRID_SIZE: number = 5;
const START_RESOURCES: number = 9;

const PLAYER_A: Player = new Player("A");
const PLAYER_B: Player = new Player("B");
const PLAYER_C: Player = new Player("C");

/*
 * Using Socket.IO to manage communication to clients. 
 */
const app = express();
const server = http.createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server);

/*
 * Boot up interface with Network States contract. 
 */
dotenv.config({ path: "../.env" });
const signer = new ethers.Wallet(
  <string>process.env.DEV_PRIV_KEY,
  new ethers.providers.JsonRpcProvider(process.env.RPC_URL)
);
const nStates = new ethers.Contract(
  <string>process.env.CONTRACT_ADDR,
  require(<string>process.env.CONTRACT_ABI).abi,
  signer
);

/*
 * Enclave's internal belief on game state stored in Grid object.
 */
let g: Grid;

/*
 * Adjust internal state based on claimed move & notifies all users to 
 * update their local views. 
 */
function move(tFrom: any, tTo: any, uFrom: any, uTo: any) {
  g.setTile(Tile.fromJSON(uFrom));
  g.setTile(Tile.fromJSON(uTo));
  io.sockets.emit("update");
}

/*
 * Exposes secrets at location l if user proves ownership of neighboring tile.
 */
function decrypt(socket: Socket, l: Location, symbol: string) {
  if (g.inFog(l, symbol)) {
    let mysteryTile = new Tile(g.mystery, l, 0, Utils.zeroFQ());
    socket.emit("decryptResponse", mysteryTile.toJSON());
    return;
  }
  socket.emit("decryptResponse", g.getTile(l).toJSON());
}

/*
 * Dev function for spawning default players on the map. 
 */
function spawnPlayers() {
  g.spawn({ r: 0, c: 0 }, PLAYER_A, START_RESOURCES);
  g.spawn({ r: 0, c: GRID_SIZE - 1 }, PLAYER_B, START_RESOURCES);
  g.spawn({ r: GRID_SIZE - 1, c: 0 }, PLAYER_C, START_RESOURCES);
}

/*
 * Attach event handlers to a new connection. 
 */
io.on("connection", (socket: Socket) => {
  console.log("Client connected: ", socket.id);

  socket.on("move", move);

  socket.on("decrypt", (l: Location, symb: string) => {
    decrypt(socket, l, symb);
  });
});

/*
 * Start server & initialize game. 
 */
server.listen(process.env.SERVER_PORT, async () => {
  g = new Grid();
  await g.setup();
  await g.seed(GRID_SIZE, true, nStates);
  spawnPlayers();

  console.log(`Server running on http://localhost:${process.env.SERVER_PORT}`);
});
