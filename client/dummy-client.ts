import dotenv from "dotenv";
import readline from "readline";
import { io, Socket } from "socket.io-client";
import {
    Address,
    createPublicClient,
    createWalletClient,
    defineChain,
    getContract,
    hexToSignature,
    http as httpTransport,
    parseEther,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { foundry } from "viem/chains";
import IWorldAbi from "../contracts/out/IWorld.sol/IWorld.json" assert { type: "json" };
import worlds from "../contracts/worlds.json" assert { type: "json" };
import { ClientToServerEvents, ServerToClientEvents } from "./socket";
import {
    Board,
    Groth16ProofCalldata,
    Player,
    ProverStatus,
    TerrainUtils,
    Tile,
    Utils,
    Location,
} from "@seismic-systems/ns-fow-game";
dotenv.config({ path: "../.env" });

/*
 * Player arguments
 */
const PLAYER_PRIVKEY: string = generatePrivateKey();
const PLAYER_SYMBOL: string = process.argv[2];
let PLAYER_SPAWN: Location;

const POSSIBLE_INPUTS = ["w", "a", "s", "d"];
const MOVE_KEYS: Record<string, number[]> = {
    w: [-1, 0],
    a: [0, -1],
    s: [1, 0],
    d: [0, 1],
};

/*
 * Contract values
 */

const redstone = defineChain({
    name: "Redstone Testnet",
    id: 901,
    network: "redstone-testnet",
    nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
    rpcUrls: {
        default: {
            http: ["https://redstone.linfra.xyz/"],
            webSocket: ["wss://redstone.linfra.xyz/"],
        },
        public: {
            http: ["https://redstone.linfra.xyz/"],
            webSocket: ["wss://redstone.linfra.xyz/"],
        },
    },
});

const CHAIN = process.env.CHAIN;
const chain = CHAIN === "redstone" ? redstone : foundry;

const worldsTyped = worlds as unknown as {
    [key: number]: { address: string; blockNumber: bigint };
};
const worldData = worldsTyped[chain.id];
const worldAddress = worldData.address as Address;
const account = privateKeyToAccount(PLAYER_PRIVKEY as Address);
const abi = IWorldAbi.abi;

const walletClient = createWalletClient({
    account,
    chain,
    transport: httpTransport(process.env.RPC_URL),
});

const publicClient = createPublicClient({
    pollingInterval: 100,
    chain,
    transport: httpTransport(process.env.RPC_URL),
});

const nStates = getContract({
    abi,
    address: worldAddress,
    walletClient,
    publicClient,
});

// Send ETH from default anvil account to this account
const anvilWalletClient = createWalletClient({
    account: privateKeyToAccount(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    ),
    chain,
    transport: httpTransport(process.env.RPC_URL),
});
await anvilWalletClient.sendTransaction({
    to: walletClient.account.address,
    value: parseEther("0.1"),
});

// Set IO
readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

let cursor: Location;

const PLAYER = new Player(PLAYER_SYMBOL, walletClient.account.address);

/*
 * Client's local belief on game state stored in Board object.
 */
let b: Board;

/*
 * Cache for terrain
 */
const terrainUtils = new TerrainUtils(
    Number(process.env.PERLIN_KEY),
    Number(process.env.PERLIN_SCALE),
    Number(process.env.PERLIN_THRESHOLD_BONUS_TROOPS),
    Number(process.env.PERLIN_THRESHOLD_HILL),
    Number(process.env.PERLIN_THRESHOLD_WATER)
);

/*
 * Whether player has been spawned in.
 */
let isSpawned = false;

/*
 * Last block when player requested an enclave signature. Player's cannot submit
 * more than one move in a block.
 */
let clientLatestMoveBlock: bigint = 0n;

/*
 * Store pending move.
 */
let currentMoveFormattedProof: Groth16ProofCalldata | undefined = undefined;
let currentVirtualFormattedProof: Groth16ProofCalldata | undefined = undefined;
let currentEnclaveSig: object | undefined = undefined;

let startProveTime: number, endProveTime: number;

/*
 * Using Socket.IO to manage communication with enclave.
 */
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    `${process.env.ENCLAVE_ADDRESS}:${process.env.ENCLAVE_SERVER_PORT}`
);

/*
 * Submits a signature of the location to the enclave, in order to decrypt
 * hidden state.
 */
function updatePlayerView(l: Location) {
    socket.emit("decrypt", Utils.stringifyLocation(l));
}

async function commitToSpawn() {
    console.log();
    console.log("Getting spawn sig from enclave");

    PLAYER_SPAWN = {
        r: Math.floor(Math.random() * 1000),
        c: Math.floor(Math.random() * 1000),
    };
    console.log(PLAYER_SPAWN);

    socket.emit(
        "getSpawnSignature",
        PLAYER.symbol,
        Utils.stringifyLocation(PLAYER_SPAWN)
    );
}

async function challengeResponse(a: string) {
    const sig = await walletClient.signMessage({ message: a });
    socket.emit("login", sig);
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
    virtPubSigs: any,
    proverStatus: ProverStatus
) {
    if (proverStatus === ProverStatus.Incomplete) {
        console.error(`Rapidsnark and snarkjs failed, canceled spawn`);
        return;
    } else {
        console.log(`${proverStatus} successfully proved virtual ZKP`);
    }

    const virtTile = Tile.fromJSON(virt);
    const spawnTile = Tile.fromJSON(spawn);

    const virtFormattedProof = await Utils.exportCallDataGroth16(
        virtPrf,
        virtPubSigs
    );
    const [virtInputs, virtProof] =
        Utils.unpackVirtualInputs(virtFormattedProof);

    const [prf, pubSigs] = await Tile.spawnZKP(PLAYER, virtTile, spawnTile);

    const spawnFormattedProof = await Utils.exportCallDataGroth16(prf, pubSigs);
    const [spawnInputs, spawnProof] =
        Utils.unpackSpawnInputs(spawnFormattedProof);
    const unpackedSig = hexToSignature(sig as Address);
    const spawnSig = {
        v: unpackedSig.v,
        r: unpackedSig.r,
        s: unpackedSig.s,
        b: 0,
    };

    console.log("Submitting spawn proof to nStates");
    try {
        const tx = await nStates.write.spawn([
            spawnInputs,
            spawnProof,
            virtInputs,
            virtProof,
            spawnSig,
        ]);
        console.log("spawn tx: ", tx);
    } catch (error) {
        console.error(error);
    }
}

/*
 * After logging in, player recieves a list of locations that they should
 * decrypt.
 */
async function loginResponse(locs: string[]) {
    updateDisplay(locs);
    cursor = PLAYER_SPAWN;
    isSpawned = true;

    console.log(`spawned at (${PLAYER_SPAWN.r}, ${PLAYER_SPAWN.c})`);

    // Wait some time for local board state to be updated
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const randomIndex = Math.floor(Math.random() * POSSIBLE_INPUTS.length);
    const randomInput = POSSIBLE_INPUTS[randomIndex];
    const currentBlockHeight: bigint = await publicClient.getBlockNumber();
    console.log("moving " + randomInput);
    await move(randomInput, currentBlockHeight);
}

/*
 * Update local view of game board based on enclave response.
 */
function decryptResponse(t: any) {
    const tl = Tile.fromJSON(t);

    b.setTile(tl);
}

/*
 * Constructs new states induced by army at cursor moving in one of the
 * cardinal directions. Alerts enclave of intended move before sending it
 * to chain. Currently hardcoded to move all but one army unit to the next
 * tile.
 */
async function move(inp: string, currentBlockHeight: bigint) {
    startProveTime = Date.now();
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

    const [uFrom, uTo, moveZKPPromise] = await b.moveZKP(
        cursor,
        { r: nr, c: nc },
        nStates
    );

    currentMoveFormattedProof = undefined;
    currentVirtualFormattedProof = undefined;

    try {
        const { proof, publicSignals } = await moveZKPPromise;
        currentMoveFormattedProof = await Utils.exportCallDataGroth16(
            proof,
            publicSignals
        );

        await tryToSubmitMove();

        // Alert enclave of intended move
        socket.emit("getMoveSignature", uFrom, uTo, PLAYER.blind.toString());

        // Update player position
        cursor = { r: nr, c: nc };
    } catch (error) {
        console.log(error);
        const randomIndex = Math.floor(Math.random() * POSSIBLE_INPUTS.length);
        const randomInput = POSSIBLE_INPUTS[randomIndex];
        const currentBlockHeight: bigint = await publicClient.getBlockNumber();
        console.log("moving " + randomInput);
        await move(randomInput, currentBlockHeight);
    }
}

/*
 * Get signature for move proposal. This signature and the queued move will be
 * sent to the chain for approval.
 */
async function moveSignatureResponse(
    sig: string,
    blockNumber: string,
    virtPrf: any,
    virtPubSigs: any,
    proverStatus: ProverStatus
) {
    console.log();
    switch (proverStatus) {
        case ProverStatus.Incomplete:
            console.error(`Rapidsnark and snarkjs failed, canceled move`);
            break;
        default:
            console.log(`${proverStatus} successfully proved virtual ZKP`);
    }

    currentVirtualFormattedProof = await Utils.exportCallDataGroth16(
        virtPrf,
        virtPubSigs
    );
    const unpackedSig = hexToSignature(sig as Address);
    currentEnclaveSig = {
        v: unpackedSig.v,
        r: unpackedSig.r,
        s: unpackedSig.s,
        b: blockNumber,
    };

    // Submit to chain if all zkps and signatures are returned
    await tryToSubmitMove();
}

/*
 * Submit pending move to contract. Will only write to nStates if 1) the player
 * has finished proving the move ZKP, 2) the enclave has finished proving
 * virtual ZKP and returned it with a signature.
 */
async function tryToSubmitMove() {
    if (
        !currentMoveFormattedProof ||
        !currentVirtualFormattedProof ||
        !currentEnclaveSig
    ) {
        return;
    }

    const [moveInputs, moveProof] = Utils.unpackMoveInputs(
        currentMoveFormattedProof
    );
    console.log(moveInputs, moveProof);
    const [virtInputs, virtProof] = Utils.unpackVirtualInputs(
        currentVirtualFormattedProof
    );

    endProveTime = Date.now();
    const provingTime = endProveTime - startProveTime;
    console.log(`Time to prove: ${provingTime}ms`);

    // Send provingTime to enclave
    fetch(
        `${process.env.ENCLAVE_ADDRESS}:${process.env.ENCLAVE_SERVER_PORT}/provingTime`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ provingTime }),
        }
    );

    const tx = await nStates.write.move([
        moveInputs,
        moveProof,
        virtInputs,
        virtProof,
        currentEnclaveSig,
    ]);
    console.log("move tx: ", tx);

    // Reset global variables when move has been submitted onchain
    currentMoveFormattedProof = undefined;
    currentVirtualFormattedProof = undefined;
    currentEnclaveSig = undefined;

    // Wait some time for local board state to be updated
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const randomIndex = Math.floor(Math.random() * POSSIBLE_INPUTS.length);
    const randomInput = POSSIBLE_INPUTS[randomIndex];
    const currentBlockHeight: bigint = await publicClient.getBlockNumber();
    console.log("moving " + randomInput);
    await move(randomInput, currentBlockHeight);
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
        }
    }
}

/*
 * Set up player session with enclave. Spawning if necessary.
 */
socket.on("connect", async () => {
    console.log("Server connection established");

    b = new Board(terrainUtils);
    b.seed();

    socket.emit("challenge");
});

socket.on("disconnect", () => {
    console.log(
        "Disconnected from Seismic socket connection. Safely terminating client..."
    );
    process.exit();
});
/*
 * Attach event handlers.
 */
socket.on("challengeResponse", challengeResponse);
socket.on("spawnSignatureResponse", spawnSignatureResponse);
socket.on("trySpawn", commitToSpawn);
socket.on("loginResponse", loginResponse);
socket.on("decryptResponse", decryptResponse);
socket.on("moveSignatureResponse", moveSignatureResponse);
socket.on("updateDisplay", updateDisplay);
