import { io, Socket } from "socket.io-client";
import { Client } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";

/*
 * Using Socket.IO to manage communication with enclave.
 */
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    `http://localhost:${process.env.ENCLAVE_SERVER_PORT}`
);

/*
 * Interface with Postgres database. Default constructor reads from
 * environment variables.
 */
const client = new Client();

function handshakeDAResponse() {
    console.log("handshake completed!");
}

function pushToDA(sender: string, ciphertext: string, iv: string, tag: string) {
    // [TODO]: add ciphertext to db
    console.log("NewEntry {");
    console.log("   sender: ", sender + ",");
    console.log("   ciphertext: ", ciphertext + ",");
    console.log("   iv: ", iv + ",");
    console.log("   tag: ", tag);
    console.log("}");
    socket.emit("pushToDAResponse");
}

function pullFromDA() {
    // [TODO]: get, delete and send to enclave: first entry of table
    socket.emit("pullFromDAResponse", true, undefined);
}

socket.on("connect", async () => {
    console.log("Connection with enclave node established");

    await client.connect();

    const res = await client.query("SELECT $1::text as message", [
        "Hello world!",
    ]);
    console.log(res.rows[0].message); // Hello world!
    await client.end();

    socket.emit("handshakeDA");
});

socket.on("handshakeDAResponse", handshakeDAResponse);
socket.on("pushToDA", pushToDA);
socket.on("pullFromDA", pullFromDA);
