import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";

const PORT: number = 3000;

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(`http://localhost:3000`);
socket.on("connect", () => {
  console.log("Connected to the server!");
});
socket.emit("move");