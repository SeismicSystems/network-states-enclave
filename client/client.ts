import readline from "readline";
import { ethers, Signature } from "ethers";
import { io, Socket } from "socket.io-client";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";
import {
    Player,
    Tile,
    Board,
    Location,
    Utils,
    Groth16ProofCalldata,
} from "../game";
import worlds from "../contracts/worlds.json";
import IWorldAbi from "../contracts/out/IWorld.sol/IWorld.json";

/*
 * Conditions depend on which player is currently active.
 */
const PLAYER_SYMBOL: string = process.argv[2];
const PLAYER_START: Location = {
    r: Number(process.argv[3]),
    c: Number(process.argv[4]),
};
const PLAYER_PRIVKEY: BigInt = BigInt(
    JSON.parse(<string>process.env.ETH_PRIVKEYS)[PLAYER_SYMBOL]
);
const PLAYER = new Player(PLAYER_SYMBOL, PLAYER_PRIVKEY);

/*
 * Misc client parameters.
 */
const BOARD_SIZE: number = parseInt(<string>process.env.BOARD_SIZE, 10);
const UPDATE_MLS: number = 1000;
const MOVE_PROMPT: string = "Next move: ";
const MOVE_KEYS: Record<string, number[]> = {
    w: [-1, 0],
    a: [0, -1],
    s: [1, 0],
    d: [0, 1],
};

/*
 * Boot up interface with 1) Network States contract and 2) the CLI.
 */
const signer = new ethers.Wallet(
    <string>process.env.PRIVATE_KEY,
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
let cursor = PLAYER_START;

/*
 * Client's local belief on game state stored in Board object.
 */
let b: Board;

/*
 * Last block when player requested an enclave signature. Player's cannot submit
 * more than one move in a block.
 */
let clientLatestMoveBlock: number;

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
    const sig = PLAYER.genSig(Player.hForDecrypt(l));
    socket.emit(
        "decrypt",
        l,
        PLAYER.bjjPub.serialize(),
        Utils.serializeSig(sig)
    );
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

        if (PLAYER.bjjPrivHash === undefined) {
            throw new Error("Can't move without a Baby Jubjub private key.");
        }

        clientLatestMoveBlock = currentBlockHeight;

        const [tFrom, tTo, uFrom, uTo, prf, pubSignals] = await b.constructMove(
            PLAYER.bjjPrivHash,
            cursor,
            { r: nr, c: nc },
            nStates
        );

        formattedProof = await Utils.exportCallDataGroth16(prf, pubSignals);

        // Update player position
        cursor = { r: nr, c: nc };

        // Alert enclave of intended move
        socket.emit("getSignature", uFrom.toJSON(), uTo.toJSON());
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

    await Utils.sleep(UPDATE_MLS);
}

/*
 * Update local view of game board based on enclave response.
 */
function decryptResponse(t: any) {
    const tl = Tile.fromJSON(t);
    b.t[tl.loc.r][tl.loc.c] = tl;

    console.clear();
    b.printView();
    process.stdout.write(MOVE_PROMPT);
}

/*
 * Get signature for move proposal. This signature and the queued move will be
 * sent to the chain for approval.
 */
async function signatureResponse(sig: string, blockNumber: number) {
    const unpackedSig: Signature = ethers.utils.splitSignature(sig);

    const moveInputs = {
        fromIsCityCenter: formattedProof.input[7] === "1",
        toIsCityCenter: formattedProof.input[8] === "1",
        takingCity: formattedProof.input[9] === "1",
        takingCapital: formattedProof.input[10] === "1",
        ontoSelfOrUnowned: formattedProof.input[4] === "1",
        fromCityId: Number(formattedProof.input[2]),
        toCityId: Number(formattedProof.input[3]),
        fromCityTroops: Number(formattedProof.input[11]),
        toCityTroops: Number(formattedProof.input[12]),
        numTroopsMoved: Number(formattedProof.input[5]),
        enemyLoss: Number(formattedProof.input[6]),
        currentInterval: formattedProof.input[0],
        fromPkHash: formattedProof.input[1],
        hTFrom: formattedProof.input[13],
        hTTo: formattedProof.input[14],
        hUFrom: formattedProof.input[15],
        hUTo: formattedProof.input[16],
    };

    const moveProof = {
        a: formattedProof.a,
        b: formattedProof.b,
        c: formattedProof.c,
    };
    const moveSig = {
        v: unpackedSig.v,
        r: unpackedSig.r,
        s: unpackedSig.s,
        b: blockNumber,
    };

    await nStates.move(moveInputs, moveProof, moveSig);
}

/*
 * Refreshes the user's game board view. Done in response to enclave ping that
 * a relevant move was made.
 */
async function updateDisplay(locs: string[]) {
    for (let l of locs) {
        const unstringified = JSON.parse(l);
        if (unstringified) {
            updatePlayerView(unstringified);
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
    await b.seed(BOARD_SIZE, false, nStates);

    // Player can submit moves starting next block
    clientLatestMoveBlock = 0;

    // Sign socket ID for login
    const sig = PLAYER.genSig(
        Player.hForLogin(Utils.asciiIntoBigNumber(socket.id))
    );
    socket.emit(
        "login",
        PLAYER_START,
        PLAYER.bjjPub.serialize(),
        PLAYER_SYMBOL,
        Utils.serializeSig(sig)
    );
});

/*
 * Game loop.
 */
process.stdin.on("keypress", async (str) => {
    const currentBlockHeight = await nStates.provider.getBlockNumber();
    if (clientLatestMoveBlock < currentBlockHeight) {
        await move(str, currentBlockHeight);
    }
});

/*
 * Attach event handlers.
 */
socket.on("loginResponse", loginResponse);
socket.on("decryptResponse", decryptResponse);
socket.on("signatureResponse", signatureResponse);
socket.on("errorResponse", errorResponse);
socket.on("updateDisplay", updateDisplay);
