import { io, Socket } from "socket.io-client";
import { Pool } from "pg";
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
const pool = new Pool();

function handshakeDAResponse() {
    console.log("handshake completed!");
}

/*
 * Adds encrypted tile as row into database.
 */
async function pushToDA(
    sender: string,
    ciphertext: string,
    iv: string,
    tag: string
) {
    const client = await pool.connect();

    await client.query(
        `INSERT INTO encrypted_tiles (sender, ciphertext, iv, tag)
        VALUES ($1, $2, $3, $4)`,
        [sender, ciphertext, iv, tag]
    );

    client.release();

    socket.emit("pushToDAResponse");
}

function pullFromDA() {
    // [TODO]: send to enclave: first entry of table
    socket.emit("pullFromDAResponse", true, undefined);
}

/*
 * Clears the table of past encrypted tiles.
 */
async function clearTable() {
    const client = await pool.connect();
    await client.query("TRUNCATE TABLE encrypted_tiles");
    client.release();
}

socket.on("connect", async () => {
    console.log("Connection with enclave node established");

    await clearTable();

    socket.emit("handshakeDA");
});

socket.on("handshakeDAResponse", handshakeDAResponse);
socket.on("pushToDA", pushToDA);
socket.on("pullFromDA", pullFromDA);
