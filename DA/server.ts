import { io, Socket } from "socket.io-client";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { ServerToClientEvents, ClientToServerEvents } from "../client/socket";

/*
 * Using Socket.IO to manage communication with enclave.
 */
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    `${process.env.ENCLAVE_ADDRESS}:${process.env.ENCLAVE_SERVER_PORT}`
);

/*
 * Interface with Postgres database. Default constructor reads from
 * environment variables.
 */
const pool = new Pool();

/*
 * Callback function called after connecting with enclave. If inRecoveryMode is
 * true, then DA should send all encrypted tiles to the enclave. Otherwise,
 * clear old data and wait for enclave to submit new tiles.
 */
async function handshakeDAResponse(inRecoveryMode: boolean) {
    await create_encrypted_tiles()
    if (inRecoveryMode) {
        // Print table count
        const client = await pool.connect();
        const numRows = (
            await client.query(`SELECT COUNT(*) FROM encrypted_tiles`)
        ).rows[0].count;
        await client.release();
        console.log("In recovery mode");
        console.log(`Number of rows in encrypted_tiles: ${numRows}`);

        // Start recovery
        await sendRecoveredTile(0);
    } else {
        // Don't need old encrypted tiles anymore
        await clearTable();

        // Start dequeuing
        socket.emit("saveToDatabaseResponse");
    }
}

/*
 * Emits encrypted tile back to enclave. Meant to be used in iteration
 */
async function sendRecoveredTile(index: number) {
    const client = await pool.connect();

    const numRows = (await client.query(`SELECT COUNT(*) FROM encrypted_tiles`))
        .rows[0].count;

    if (index < numRows) {
        // Get recoverModeIndex'th row
        const res = await client.query(
            `SELECT * FROM encrypted_tiles
            LIMIT 1
            OFFSET ${index}`
        );

        client.release();

        socket.emit("sendRecoveredTileResponse", {
            symbol: res.rows[0].symbol,
            address: res.rows[0].address,
            ciphertext: res.rows[0].ciphertext,
            iv: res.rows[0].iv,
            tag: res.rows[0].tag,
        });
    } else {
        socket.emit("recoveryFinished");
    }
}
/*
 * Adds encrypted tile as row into database.
 */
async function saveToDatabase(encTile: any) {
    const symbol = encTile.symbol;
    const address = encTile.address;
    const ciphertext = encTile.ciphertext;
    const iv = encTile.iv;
    const tag = encTile.tag;

    if (
        symbol == undefined ||
        address == undefined ||
        ciphertext == undefined ||
        iv == undefined ||
        tag == undefined
    ) {
        return;
    }

    const client = await pool.connect();
    await client.query(
        `INSERT INTO 
        encrypted_tiles (symbol, address, ciphertext, iv, tag)
        VALUES ($1, $2, $3, $4, $5)`,
        [symbol, address, ciphertext, iv, tag]
    );
    console.log("Inserted");

    client.release();

    socket.emit("saveToDatabaseResponse");
}
async function create_encrypted_tiles(){
    const client = await pool.connect();
    const tableName = 'encrypted_tiles';
    const columns = `symbol text, address text, ciphertext text, iv text, tag text`;

    const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns});`;
    await client.query(query, (err, res) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('Table created successfully');
        }
      });
     client.release();
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

    // Set DA's socket ID and query inRecoveryResponse variable
    socket.emit("handshakeDA");
});

socket.on("handshakeDAResponse", handshakeDAResponse);
socket.on("sendRecoveredTile", sendRecoveredTile);
socket.on("saveToDatabase", saveToDatabase);
