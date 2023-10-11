import { io, Socket } from "socket.io-client";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";

/*
 * Using Socket.IO to manage communication with enclave.
 */
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    `http://localhost:${process.env.ENCLAVE_SERVER_PORT}`
);

function handshakeDAResponse() {
    console.log("handshake completed!");
}

function updateDA(sender: string, ciphertext: string, iv: string, tag: string) {
    // [TODO]: add ciphertext to db
    console.log("NewEntry {");
    console.log("   sender: ", sender + ",");
    console.log("   ciphertext: ", ciphertext + ",");
    console.log("   iv: ", iv + ",");
    console.log("   tag: ", tag);
    console.log("}");
    socket.emit("updateDAResponse");
}

socket.on("connect", async () => {
    console.log("Connection with enclave node established");

    socket.emit("handshakeDA");
});

socket.on("handshakeDAResponse", handshakeDAResponse);
socket.on("updateDA", updateDA);
