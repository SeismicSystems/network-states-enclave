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

/*
 * Number of database entries.
 */
let numRows: number;

/*
 * Callback function called after connecting with enclave. If inRecoveryMode is
 * true, then DA should send all encrypted tiles to the enclave. Otherwise,
 * clear old data and wait for enclave to submit new tiles.
 */
async function handshakeDAResponse(inRecoveryMode: boolean) {
    if (inRecoveryMode) {
        // Start recovery
        await recoverTile(0);
    } else {
        // Don't need old encrypted tiles anymore
        await clearTable();

        // Start dequeuing
        socket.emit("pushToDAResponse");
    }
}

/*
 * Emits encrypted tile back to enclave. Meant to be used in iteration
 */
async function recoverTile(index: number) {
    if (index < numRows) {
        const client = await pool.connect();

        // Get recoverModeIndex'th row
        const res = await client.query(
            `SELECT * FROM encrypted_tiles
            LIMIT 1
            OFFSET ${index}`
        );

        client.release();

        socket.emit(
            "recoverTileResponse",
            res.rows[0].symbol,
            res.rows[0].pubkey,
            res.rows[0].ciphertext,
            res.rows[0].iv,
            res.rows[0].tag
        );
    } else {
        socket.emit("recoveryFinished");
    }
}
/*
 * Adds encrypted tile as row into database.
 */
async function pushToDA(
    symbol: string,
    pubkey: string,
    ciphertext: string,
    iv: string,
    tag: string
) {
    const client = await pool.connect();
    await client.query(
        `INSERT INTO encrypted_tiles (symbol, pubkey, ciphertext, iv, tag)
        VALUES ($1, $2, $3, $4, $5)`,
        [symbol, pubkey, ciphertext, iv, tag]
    );
    console.log("insert ", numRows);

    client.release();

    numRows++;

    socket.emit("pushToDAResponse");
}

/*
 * Clears the table of past encrypted tiles.
 */
async function clearTable() {
    const client = await pool.connect();
    await client.query("TRUNCATE TABLE encrypted_tiles");
    client.release();

    numRows = 0;
}

socket.on("connect", async () => {
    console.log("Connection with enclave node established");

    // numRows
    const client = await pool.connect();
    numRows = (await client.query(`SELECT COUNT(*) FROM encrypted_tiles`))
        .rows[0].count;
    client.release();

    // Set DA's socket ID and query inRecoveryResponse variable
    socket.emit("handshakeDA");
});

socket.on("handshakeDAResponse", handshakeDAResponse);
socket.on("recoverTile", recoverTile);
socket.on("pushToDA", pushToDA);
