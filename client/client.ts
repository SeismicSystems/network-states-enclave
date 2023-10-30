import readline from "readline";
import { BigNumber, ethers, Signature } from "ethers";
import { io, Socket } from "socket.io-client";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";
import { Tile, Location } from "../game/Tile.js";
import { Player } from "../game/Player.js";
import { Board } from "../game/Board.js";
import { Utils, Groth16ProofCalldata, Groth16Proof } from "../game/Utils.js";
import worlds from "../contracts/worlds.json" assert { type: "json" };
import IWorldAbi from "../contracts/out/IWorld.sol/IWorld.json" assert { type: "json" };

/*
 * Conditions depend on which player is currently active.
 */
const PLAYER_SYMBOL: string = process.argv[2];
const PLAYER_PRIVKEY = JSON.parse(<string>process.env.ETH_PRIVKEYS)[
    PLAYER_SYMBOL
];

/*
 * Misc client parameters.
 */
const BOARD_SIZE: number = parseInt(<string>process.env.BOARD_SIZE, 10);
const MOVE_PROMPT: string = "Next move: ";

const MOVE_KEYS: Record<string, bigint[]> = {
    w: [BigInt(-1), BigInt(0)],
    a: [BigInt(0), BigInt(-1)],
    s: [BigInt(1), BigInt(0)],
    d: [BigInt(0), BigInt(1)],
};

/*
 * Boot up interface with 1) Network States contract and 2) the CLI.
 */
const signer = new ethers.Wallet(
    PLAYER_PRIVKEY,
    new ethers.providers.JsonRpcProvider(process.env.RPC_URL)
);
const nStates = new ethers.Contract(
    worlds[31337].address,
    IWorldAbi.abi,
    signer
);
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
let cursor: Location;

const PLAYER = new Player(PLAYER_SYMBOL, signer.address);

/*
 * Client's local belief on game state stored in Board object.
 */
let b: Board;

/*
 * Whether player has been spawned in.
 */
let isSpawned = false;

/*
 * Last block when player requested an enclave signature. Player's cannot submit
 * more than one move in a block.
 */
let clientLatestMoveBlock: number = 0;

/*
 * Last block when player commited to spawning.
 */
let commitBlockNumber: number;

/*
 * Block hash of block number 'commitBlockNumber'. Used to get spawn location,
 */
let commitBlockHash;

/*
 * Store pending move.
 */
let formattedProof: Groth16ProofCalldata;

/*
 * Using Socket.IO to manage communication with enclave.
 */
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    `http://localhost:${process.env.ENCLAVE_SERVER_PORT}`
);

/*
 * Submits a signature of the location to the enclave, in order to decrypt
 * hidden state.
 */
function updatePlayerView(l: Location) {
    socket.emit("decrypt", Utils.stringifyLocation(l));
}

async function commitToSpawn() {
    PLAYER.sampleBlind();

    // Save block number player commited to spawning
    commitBlockNumber = await PLAYER.commitToSpawn(nStates);
    commitBlockHash = await nStates.getBlockHash(commitBlockNumber);

    console.log("Getting spawn sig from enclave");

    socket.emit("getSpawnSignature", PLAYER.symbol, PLAYER.blind.toString());
}

/*
 * Response to getSpawnSignature. No matter if the response contains valid tiles
 * or null values indicating that location is not spawnable, the player must
 * send a zkp in order to try again.
 */
async function spawnSignatureResponse(
    virt: any,
    spawn: any,
    sig: string,
    virtPrf: any,
    virtPubSigs: any
) {
    const virtTile = Tile.fromJSON(virt);
    const spawnTile = Tile.fromJSON(spawn);

    const virtFormattedProof = await Utils.exportCallDataGroth16(
        virtPrf,
        virtPubSigs
    );
    const [virtInputs, virtProof] =
        Utils.unpackVirtualInputs(virtFormattedProof);

    const [prf, pubSigs] = await PLAYER.constructSpawn(
        commitBlockHash,
        virtTile,
        spawnTile
    );

    const spawnFormattedProof = await Utils.exportCallDataGroth16(prf, pubSigs);
    const [spawnInputs, spawnProof, spawnSig] = Utils.unpackSpawnInputs(
        spawnFormattedProof,
        sig,
        commitBlockNumber
    );

    console.log("Submitting spawn proof to nStates");
    try {
        await nStates.spawn(
            spawnInputs,
            spawnProof,
            virtInputs,
            virtProof,
            spawnSig
        );
        cursor = spawnTile.loc;
    } catch (error) {
        console.error(error);
    }
}

/*
 * Constructs new states induced by army at cursor moving in one of the
 * cardinal directions. Alerts enclave of intended move before sending it
 * to chain. Currently hardcoded to move all but one army unit to the next
 * tile.
 */
async function move(inp: string, currentBlockHeight: number) {
    try {
        if (inp !== "w" && inp !== "a" && inp !== "s" && inp !== "d") {
            throw new Error("Invalid move input.");
        }

        // Construct move states
        const nr = cursor.r + MOVE_KEYS[inp][0],
            nc = cursor.c + MOVE_KEYS[inp][1];

        if (!b.inBounds(nr, nc)) {
            throw new Error("Cannot move off the board.");
        }

        clientLatestMoveBlock = currentBlockHeight;

        const [tFrom, tTo, uFrom, uTo, prf, pubSignals] = await b.constructMove(
            cursor,
            { r: nr, c: nc },
            nStates
        );

        formattedProof = await Utils.exportCallDataGroth16(prf, pubSignals);

        // Update player position
        cursor = { r: nr, c: nc };

        // Alert enclave of intended move
        socket.emit("getMoveSignature", uFrom, uTo, PLAYER.blind.toString());
    } catch (error) {
        console.log(error);
    }
}

/*
 * After logging in, player recieves a list of locations that they should
 * decrypt.
 */
async function loginResponse(locs: string[]) {
    updateDisplay(locs);
    isSpawned = true;
}

/*
 * Update local view of game board based on enclave response.
 */
function decryptResponse(t: any) {
    const tl = Tile.fromJSON(t);

    b.t.set(Utils.stringifyLocation(tl.loc), tl);

    console.clear();
    b.printView();
    process.stdout.write(MOVE_PROMPT);
}

/*
 * Get signature for move proposal. This signature and the queued move will be
 * sent to the chain for approval.
 */
async function moveSignatureResponse(
    sig: string,
    blockNumber: number,
    virtPrf: any,
    virtPubSigs: any
) {
    const [moveInputs, moveProof, moveSig] = Utils.unpackMoveInputs(
        formattedProof,
        sig,
        blockNumber
    );
    const virtFormattedProof = await Utils.exportCallDataGroth16(
        virtPrf,
        virtPubSigs
    );
    const [virtInputs, virtProof] =
        Utils.unpackVirtualInputs(virtFormattedProof);

    await nStates.move(moveInputs, moveProof, virtInputs, virtProof, moveSig);
}

/*
 * Refreshes the user's game board view. Done in response to enclave ping that
 * a relevant move was made.
 */
async function updateDisplay(locs: string[]) {
    for (let i = 0; i < locs.length; i++) {
        const l = Utils.unstringifyLocation(locs[i]);
        if (l) {
            updatePlayerView(l);

            // Set cursor if not previously set
            if (i == 0 && !cursor) {
                cursor = l;
            }
        }
    }
}

async function errorResponse(msg: string) {
    console.log("Enclave error: ", msg);
}

/*
 * Set up player session with enclave. Spawning if necessary.
 */
socket.on("connect", async () => {
    console.log("Server connection established");

    b = new Board();

    // Pass in dummy function to terrain generator because init is false
    await b.seed();

    const sig = await signer.signMessage(socket.id);
    socket.emit("login", PLAYER.address, sig);
});

/*
 * Game loop.
 */
process.stdin.on("keypress", async (str) => {
    const currentBlockHeight = await nStates.provider.getBlockNumber();
    if (clientLatestMoveBlock < currentBlockHeight && isSpawned) {
        await move(str, currentBlockHeight);
    }
});

/*
 * Attach event handlers.
 */
socket.on("spawnSignatureResponse", spawnSignatureResponse);
socket.on("trySpawn", commitToSpawn);
socket.on("loginResponse", loginResponse);
socket.on("decryptResponse", decryptResponse);
socket.on("moveSignatureResponse", moveSignatureResponse);
socket.on("errorResponse", errorResponse);
socket.on("updateDisplay", updateDisplay);
