import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "./socket";
import { Tile, Player, Board, Location, Utils } from "../game";

/*
 * Set game parameters and define default players.
 */
const BOARD_SIZE: number = parseInt(<string>process.env.BOARD_SIZE, 10);
const START_RESOURCES: number = parseInt(
  <string>process.env.START_RESOURCES,
  10
);
const PLAYER_A: Player = new Player("A", <string>process.env.A_ETH_PRIV);
const PLAYER_B: Player = new Player("B", <string>process.env.B_ETH_PRIV);
const PLAYER_C: Player = new Player("C", <string>process.env.C_ETH_PRIV);

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
 * Enclave's internal belief on game state stored in Board object.
 */
let b: Board;

/*
 * Adjust internal state based on claimed move & notifies all users to
 * update their local views.
 */
function move(tFrom: any, tTo: any, uFrom: any, uTo: any) {
  b.setTile(Tile.fromJSON(uFrom));
  b.setTile(Tile.fromJSON(uTo));
  io.sockets.emit("updateDisplay");
}

/*
 * Exposes secrets at location l if user proves ownership of neighboring tile.
 */
function decrypt(socket: Socket, l: Location, symbol: string) {
  if (b.inFog(l, symbol)) {
    let mysteryTile = new Tile(Board.MYSTERY, l, 0, Utils.zeroFQ());
    socket.emit("decryptResponse", mysteryTile.toJSON());
    return;
  }
  socket.emit("decryptResponse", b.getTile(l).toJSON());
}

/*
 * Dev function for spawning default players on the map.
 */
function spawnPlayers() {
  b.spawn({ r: 0, c: 0 }, PLAYER_A, START_RESOURCES);
  b.spawn({ r: 0, c: BOARD_SIZE - 1 }, PLAYER_B, START_RESOURCES);
  b.spawn({ r: BOARD_SIZE - 1, c: 0 }, PLAYER_C, START_RESOURCES);
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
  b = new Board();
  await b.setup();
  await b.seed(BOARD_SIZE, true, nStates);
  spawnPlayers();

  console.log(`Server running on http://localhost:${process.env.SERVER_PORT}`);
});
