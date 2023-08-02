

// const app = express();
// const server = http.createServer(app);
// const io = new socketio.Server<
//   ClientToServerEvents,
//   ServerToClientEvents,
//   InterServerEvents,
//   SocketData
// >(server, {
//   transports: ["websocket"],
//   cors: {
//     origin: "http://localhost:9274"
//   }
// });

// app.get('/', (req, res) => {
//   console.log("REQ: ", req);
// });

// io.on("connection", (socket) => {
//   console.log("Client connected:", socket.id);

//   socket.on("move", () => {
//     console.log("LOGGED A MOVE");
//   });
// });

// server.listen(9274, () => {
//   console.log("Listening on localhost:9274");
// });


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

io.on("connection", (socket: Socket) => {
  console.log("Client connected: ", socket.id);

  socket.on("move", () => {
    console.log("LOGGED A MOVE");
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// // (async () => {
// //   const g = new Grid(GRID_SIZE, UNOWNED);

// //   g.spawn(0, 0, PLAYER_A, START_RESOURCES);
// //   g.spawn(0, GRID_SIZE - 1, PLAYER_B, START_RESOURCES);
// //   g.spawn(GRID_SIZE - 1, 0, PLAYER_C, START_RESOURCES);

// //   console.log(g.toString());
// //   process.exit(0);
// // })();