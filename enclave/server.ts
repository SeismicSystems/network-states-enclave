import { exec as execCb } from "child_process";
import dotenv from "dotenv";
import express from "express";
import * as fs from "fs";
import http from "http";
import { Queue } from "queue-typescript";
import { Server, Socket } from "socket.io";
import { promisify } from "util";
import {
    Address,
    createPublicClient,
    createWalletClient,
    defineChain,
    encodeAbiParameters,
    getContract,
    http as httpTransport,
    keccak256,
    parseAbiItem,
    recoverMessageAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import IWorldAbi from "../contracts/out/IWorld.sol/IWorld.json" assert { type: "json" };
import worlds from "../contracts/worlds.json" assert { type: "json" };
import {
    ClientToServerEvents,
    InterServerEvents,
    ServerToClientEvents,
    SocketData,
} from "../client/socket";
import {
    Board,
    Player,
    ProverStatus,
    TerrainUtils,
    Tile,
    Utils,
    Location,
} from "@seismic-systems/ns-fow-game";
dotenv.config({ path: "../.env" });
const exec = promisify(execCb);

const ENCLAVE_STARTUP_TIMESTAMP = new Date()
    .toISOString()
    .replace(/[:.-]/g, "");

/*
 * Whether the enclave's global state should be blank or pull from DA.
 */
let inRecoveryMode = process.argv[2] == "1";

/*
 * All NewTile Events emitted
 */
let hashHistory: Set<string>;

/*
 * Contract values
 */
const CHAIN_ID = Number(process.env.CHAIN_ID);
const worldsTyped = worlds as { [key: number]: { address: string } };
const worldData = worldsTyped[CHAIN_ID];
const worldAddress = worldData.address as Address;
const account = privateKeyToAccount(process.env.PRIVATE_KEY as Address);
const abi = IWorldAbi.abi;
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

const walletClient = createWalletClient({
    account,
    chain: redstone,
    transport: httpTransport(process.env.RPC_URL),
});

const publicClient = createPublicClient({
    chain: redstone,
    transport: httpTransport(process.env.RPC_URL),
});

const nStates = getContract({
    abi,
    address: worldAddress,
    walletClient,
    publicClient,
});

/*
 * Set game parameters and create dummy players.
 */
const START_RESOURCES: number = parseInt(
    <string>process.env.START_RESOURCES,
    10
);

/*
 * Number of blocks that a claimed move is allowed to be pending without being
 * deleted.
 */
const CLAIMED_MOVE_LIFE_SPAN = BigInt(
    <string>process.env.CLAIMED_MOVE_LIFE_SPAN
);

/*
 * Using Socket.IO to manage communication to clients.
 */
const app = express();
app.use(express.json());

app.get("/ping", (req, res) => {
    res.sendStatus(200);
});

app.post("/provingTime", (req, res) => {
    const provingTime = req.body.provingTime;
    fs.appendFile(
        `bin/proving_times_${ENCLAVE_STARTUP_TIMESTAMP}.txt`,
        provingTime + "\n",
        (err: any) => {
            if (err) throw err;
        }
    );
    res.sendStatus(200);
});

const server = http.createServer(app);

console.log("Warning: currently accepting requests from all origins");
const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>(server, { cors: { origin: "*" } });

/*
 * Enclave randomness that it commits to in contract. Used for virtual tile
 * commitments.
 */
let rand: bigint;
let hRand: bigint;

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

type ClaimedSpawn = {
    virtTile: Tile;
    spawnTile: Tile;
};

type ClaimedMove = {
    uFrom: Tile;
    uTo: Tile;
    blockSubmitted: bigint;
    uFromEnc: EncryptedTile;
    uToEnc: EncryptedTile;
};

type EncryptedTile = {
    symbol: string;
    address: string;
    ciphertext: string;
    iv: string;
    tag: string;
};

/*
 * Enclave's internal belief on game state stored in Board object.
 */
let b: Board;

/*
 * City ID given to each spawning player. Increments by one each time.
 *
 * [TODO]: eventually, the client will sample their own cityId, and the contract
 * will check that the cityId is not in use.
 */
let cityId: number = 1;

/*
 * Bijection between player's public keys and their socket IDs.
 */
let idToAddress = new Map<string, string>();
let addressToId = new Map<string, string>();

/*
 * Moves claimed by players. A move is finalized whenever NewMove event is
 * emitted.
 */
let claimedMoves = new Map<string, ClaimedMove>();

/*
 * Spawn attempts players successfully commit. Player is spawned in whenever a
 * Spawn event is emitted.
 */
let claimedSpawns = new Map<string, ClaimedSpawn>();

/*
 * Current block height. Storing the value in a variable saves from
 * unnecessarily indexing twice.
 */
let currentBlockHeight: bigint;

/*
 * Latest block height players proposed a move.
 */
let playerLatestBlock = new Map<string, bigint>();

/*
 * Encryption key for global state sent to DA.
 */
let tileEncryptionKey: Buffer;

/*
 * Socket ID of DA node.
 */
let socketIdDA: string | undefined;

/*
 * Queue of claimed new tile states that have yet to be pushed to DA.
 */
let queuedTilesDA = new Queue<EncryptedTile>();

/*
 * Index for retrieving encrypted tiles from DA node.
 */
let recoveryModeIndex = 0;

/*
 * If player is already spawned, return visible tiles for decryption. If not,
 * tell player to initiate spawning.
 */
async function login(socket: Socket, address: string, sigStr: string) {
    if (inRecoveryMode) {
        socket.disconnect();
        return;
    }

    if (addressToId.has(address)) {
        console.log("Address already logged on");
        socket.disconnect();
        return;
    }

    let sender: string | undefined;
    try {
        sender = await recoverMessageAddress({
            message: socket.id,
            signature: sigStr as Address,
        });
    } catch (error) {
        console.log("Malignant signature", sigStr);
        socket.disconnect();
        return;
    }

    if (!sender || address != sender) {
        console.log("Incorrect address given or bad signature");
        socket.disconnect();
        return;
    }

    idToAddress.set(socket.id, address);
    addressToId.set(address, socket.id);

    if (b.isSpawned(new Player("", address))) {
        idToAddress.set(socket.id, address);
        addressToId.set(address, socket.id);

        playerLatestBlock.set(address, 0n);

        let visibleTiles = new Set<string>();
        b.playerCities.get(address)?.forEach((cityId: number) => {
            b.cityTiles.get(cityId)?.forEach((locString: string) => {
                const loc = Utils.unstringifyLocation(locString);
                if (loc) {
                    for (let l of b.getNearbyLocations(loc)) {
                        visibleTiles.add(Utils.stringifyLocation(l));
                    }
                }
            });
        });
        socket.emit("loginResponse", Array.from(visibleTiles));
    } else {
        socket.emit("trySpawn");
    }
}

/*
 * Propose to spawn at location l. Returns a signature of the old and new tiles
 * at location for contract to verify, or null value if player cannot spawn at
 * this location.
 */
async function sendSpawnSignature(
    socket: Socket,
    symbol: string,
    l: string,
    blind: string
) {
    const sender = idToAddress.get(socket.id);
    if (inRecoveryMode || !sender) {
        socket.disconnect();
        return;
    }

    if (claimedSpawns.has(sender)) {
        console.log("Already committed to spawn");
        socket.disconnect();
        return;
    }

    let playerChallenge: bigint;
    try {
        playerChallenge = BigInt(blind);
    } catch (error) {
        console.log("Malignant secret: ", blind);
        socket.disconnect();
        return;
    }

    let loc: Location | undefined;

    try {
        loc = Utils.unstringifyLocation(l);
    } catch (error) {
        console.log("Malignant location string: ", l);
        socket.disconnect();
    }

    if (!loc) {
        console.log("Location is undefined");
        return;
    }

    const virtTile = Tile.genVirtual(loc, rand, terrainUtils);
    const tile = b.getTile(loc, rand);
    if (!virtTile.isSpawnable() || !tile || !tile.isUnowned()) {
        console.log("Tile cannot be spawned on");
        socket.emit("trySpawn");
        return;
    }

    // Pair the public key and the socket ID
    idToAddress.set(socket.id, sender);
    addressToId.set(sender, socket.id);

    const spawnTile = Tile.spawn(
        new Player(symbol, sender),
        loc,
        START_RESOURCES,
        cityId
    );
    // TODO : Why CityID is incremental it would create colision in multiple instances -> hashstring or anyrandom=> 10^9
    cityId++; // store it dynamo or redis or randomnumber
    const hSpawnTile = spawnTile.hash();

    const { proof, publicSignals, proverStatus } = await virtualZKP(
        virtTile,
        socket.id
    );

    // Acknowledge reception of intended move
    const abiEncoded = encodeAbiParameters(
        [{ name: "hSpawnTile", type: "uint256" }],
        [BigInt(hSpawnTile)]
    );
    const sig = await walletClient.signMessage({
        message: { raw: keccak256(abiEncoded) },
    });

    socket.emit(
        "spawnSignatureResponse",
        virtTile,
        spawnTile,
        sig,
        proof,
        publicSignals,
        proverStatus
    );

    claimedSpawns.set(sender, { virtTile, spawnTile });
}

/*
 * Generates a ZKP that attests to the faithful computation of a virtual
 * tile given some committed randomness. Requester of this ZKP also provides
 * a blinding factor for location so they can use it in their client-side
 * ZKP. Uses rapidsnark prover if possible, otherwise snarkjs.
 */
async function virtualZKP(virtTile: Tile, socketId: string) {
    const inputs = {
        hRand: hRand.toString(),
        hVirt: virtTile.hash(),
        rand: rand.toString(),
        virt: virtTile.toCircuitInput(),
    };

    let proof;
    let publicSignals;
    let proverStatus = ProverStatus.Incomplete;
    try {
        // Unique ID for proof-related files
        const proofId = socketId + "-" + inputs.hVirt;

        // Write the inputs to bin/input-proofId.json
        fs.writeFileSync(`bin/input-${proofId}.json`, JSON.stringify(inputs));

        // Call virtual-prover.sh
        console.log(`Proving virtual ZKP with ID = ${proofId}`);
        const startTime = Date.now();
        await exec(`../enclave/scripts/virtual-prover.sh ${proofId}`);
        const endTime = Date.now();

        const proverTime = endTime - startTime;
        console.log(`virtual-prover.sh: completed in ${proverTime} ms`);

        // Read from bin/proof-proofId.json and bin/public-proofId.json
        proof = JSON.parse(
            fs.readFileSync(`bin/proof-${proofId}.json`, "utf8")
        );
        proof.curve = "bn128";
        publicSignals = JSON.parse(
            fs.readFileSync(`bin/public-${proofId}.json`, "utf8")
        );

        // Remove the generated files
        await exec(`rm -rf bin/*-${proofId}.*`);

        proverStatus = ProverStatus.Rapidsnark;
    } catch (error) {
        console.error(`Error: ${error}`);
    }

    if (proverStatus === ProverStatus.Incomplete) {
        try {
            // If rapidsnark fails, run snarkjs prover
            console.log(`Proving virtual ZKP with snarkjs`);
            const startTime = Date.now();
            [proof, publicSignals] = await Tile.virtualZKP(inputs);
            const endTime = Date.now();

            const proverTime = endTime - startTime;
            console.log(`snarkjs: completed in ${proverTime} ms`);

            proverStatus = ProverStatus.Snarkjs;
        } catch (error) {
            console.error(`Error: ${error}`);
            proverStatus = ProverStatus.Incomplete;
        }
    }

    return { proof, publicSignals, proverStatus };
}

/*
 * Propose move to enclave. In order for the move to be solidified, the enclave
 * must respond to a leaf event.
 */
async function sendMoveSignature(
    socket: Socket,
    uFrom: any,
    uTo: any,
    blind: string
) {
    const sender = idToAddress.get(socket.id);
    if (inRecoveryMode || !sender) {
        // Cut the connection
        socket.disconnect();
        return;
    }

    let playerChallenge: bigint;
    try {
        playerChallenge = BigInt(blind);
    } catch (error) {
        console.log("Malignant secret: ", blind);
        socket.disconnect();
        return;
    }

    // Players cannot make more than one move per block
    const latestBlock = playerLatestBlock.get(sender);
    if (
        latestBlock != undefined &&
        latestBlock < currentBlockHeight &&
        uFrom.address == sender
    ) {
        const uFromAsTile = Tile.fromJSON(uFrom);
        const hUFrom = uFromAsTile.hash();
        const uToAsTile = Tile.fromJSON(uTo);
        const hUTo = uToAsTile.hash();

        // Generate ZKP that attests to valid virtual tile commitment
        const virtTile = Tile.genVirtual(uToAsTile.loc, rand, terrainUtils);
        const { proof, publicSignals, proverStatus } = await virtualZKP(
            virtTile,
            socket.id
        );

        const abiEncoded = encodeAbiParameters(
            [
                { name: "currentBlockHeight", type: "uint256" },
                { name: "hUFrom", type: "uint256" },
                { name: "hUTo", type: "uint256" },
            ], 
            [currentBlockHeight, BigInt(hUFrom), BigInt(hUTo)]
        );
        const sig = await walletClient.signMessage({
            message: { raw: keccak256(abiEncoded) },
        });

        socket.emit(
            "moveSignatureResponse",
            sig,
            currentBlockHeight.toString(),
            proof,
            publicSignals,
            proverStatus
        );

        playerLatestBlock.set(sender, currentBlockHeight);

        // Push to DA
        const uFromEnc = enqueueTile(uFromAsTile);
        const uToEnc = enqueueTile(uToAsTile);

        claimedMoves.set(hUFrom.concat(hUTo), {
            uFrom: uFromAsTile,
            uTo: uToAsTile,
            blockSubmitted: currentBlockHeight,
            uFromEnc,
            uToEnc,
        });
        // tiles-> location(string)-> tile -> recovery ()
        // City
        // Clear queue if DA node is online
        dequeueTileIfDAConnected();
    } else {
        // Cut the connection
        socket.disconnect();
    }
}

/*
 * Exposes secrets at location l if a requesting player proves ownership of
 * neighboring tile.
 */
function decrypt(socket: Socket, l: string) {
    if (inRecoveryMode || !idToAddress.has(socket.id)) {
        socket.disconnect();
        return;
    }

    const loc = Utils.unstringifyLocation(l);
    if (!loc) {
        socket.disconnect();
        return;
    }

    const owner = new Player("", idToAddress.get(socket.id)!);
    if (b.noFog(loc, owner, rand)) {
        socket.emit("decryptResponse", b.getTile(loc, rand));
    } else {
        socket.emit("decryptResponse", Tile.mystery(loc));
    }
}

/*
 * When a player disconnects, we remove the relation between their socket ID and
 * their public key. This is so that no other player gains that ID and can play
 * on their behalf.
 */
function disconnect(socket: Socket) {
    const address = idToAddress.get(socket.id);
    if (address) {
        addressToId.delete(address);
        idToAddress.delete(socket.id);
    }
    if (socketIdDA == socket.id) {
        socketIdDA = undefined;
    }
    console.log("Disconnected:", socket.id);
}

/*
 * Callback function for when a NewSpawnAttempt event is emitted. Event is
 * emitted when a player tries to spawn in, whether or not they can. After
 * doing so, they should be allowed to try to spawn again.
 */
function onSpawnAttempt(player: string, success: boolean) {
    if (inRecoveryMode) {
        return;
    }

    const spawn = claimedSpawns.get(player);
    claimedSpawns.delete(player);
    const socketId = addressToId.get(player);

    if (success && spawn && socketId) {
        // Spawn in player
        b.setTile(spawn.spawnTile);

        playerLatestBlock.set(player, 0n);

        enqueueTile(spawn.spawnTile);
        dequeueTileIfDAConnected();

        const visibleLocs = b
            .getNearbyLocations(spawn.spawnTile.loc)
            .map((loc) => Utils.stringifyLocation(loc));

        io.to(socketId).emit("loginResponse", visibleLocs);
    } else if (!success && socketId) {
        io.to(socketId).emit("trySpawn");
    } else if (socketId) {
        console.error(`Player ${player} spawned without a signature.`);
    }
}

/*
 * Callback function for when a NewMove event is emitted. Reads claimed move
 * into enclave's internal beliefs, and alerts players in range to decrypt.
 */
function onMoveFinalize(hUFrom: string, hUTo: string) {
    if (inRecoveryMode) {
        return;
    }
    const moveHash = hUFrom.concat(hUTo);
    const move = claimedMoves.get(moveHash);
    if (move) {
        // Move is no longer pending
        claimedMoves.delete(moveHash);

        // Before state is updated, we need the previous 'to' tile owner
        const tTo = b.getTile(move.uTo.loc, rand);
        if (!tTo) {
            return;
        }

        const newOwner = move.uTo.owner.address;
        const prevOwner = tTo.owner.address;
        const ownershipChanged = prevOwner !== newOwner;

        // Alert all nearby players that an updateDisplay is needed
        let updatedLocs = [move.uFrom.loc];
        if (ownershipChanged && tTo.isCityCenter()) {
            b.cityTiles.get(tTo.cityId)?.forEach((locString: string) => {
                const loc = Utils.unstringifyLocation(locString);
                if (loc) {
                    updatedLocs.push(loc);
                }
            });
        } else {
            updatedLocs.push(move.uTo.loc);
        }
        // Replaying all of request( this currently) 

        // Update state
        // TODO : Why update ufrm  -> u r storing history user operation contracts ->
        // contracts:- A-3,  B->3- === B=3
        // ufrom uto
        b.setTile(move.uFrom);
        b.setTile(move.uTo);

        // Add finalized states and try to send to DA
        // TODO : Why we enque only ufrom and uto why not all updated locs
        enqueueTile(move.uFrom);
        enqueueTile(move.uTo);
        dequeueTileIfDAConnected();

        alertPlayers(newOwner, prevOwner, updatedLocs);
    } else {
        console.error(
            `Move: (${hUFrom}, ${hUTo}) was finalized without a signature.`
        );
    }
}

/*
 * Helper function for onMoveFinalize. Pings players when locations should be
 * decrypted. For each location in updatedLocs, the previous and new owner
 * decrypt all tiles in the 3x3 region, and nearby players decrypt the tile in
 * updatedLocs.
 */
function alertPlayers(
    newOwner: string,
    prevOwner: string,
    updatedLocs: Location[]
) {
    let alertPlayerMap = new Map<string, Set<string>>();

    for (let loc of updatedLocs) {
        const locString = Utils.stringifyLocation(loc);
        for (let l of b.getNearbyLocations(loc)) {
            const tile = b.getTile(l, rand);
            if (tile) {
                const tileOwner = tile.owner.address;
                const lString = Utils.stringifyLocation(l);

                if (!alertPlayerMap.has(tileOwner)) {
                    alertPlayerMap.set(tileOwner, new Set<string>());
                }
                alertPlayerMap.get(tileOwner)?.add(locString);
                alertPlayerMap.get(newOwner)?.add(lString);
                alertPlayerMap.get(prevOwner)?.add(lString);
            }
        }
    }

    alertPlayerMap.forEach((tiles: Set<string>, pubkey: string) => {
        const socketId = addressToId.get(pubkey);
        if (socketId) {
            io.to(socketId).emit("updateDisplay", Array.from(tiles));
        }
    });
}

/*
 * Sets the socket ID of the DA node, if not already set. Sends back
 * inRecoveryMode variable.
 */
async function handshakeDA(socket: Socket) {
    if (socketIdDA == undefined) {
        socketIdDA = socket.id;

        // Fetch all NewTile events
        const newTileLogs = await publicClient.getLogs({
            event: parseAbiItem("event NewTile(uint256 indexed hTile)"),
            strict: true,
        });
        hashHistory = new Set<string>();
        newTileLogs.forEach((e) => {
            hashHistory.add(e.args.hTile.toString());
        });

        io.to(socketIdDA).emit("handshakeDAResponse", inRecoveryMode);
    } else {
        // If DA socket ID is already set, then do nothing and break connection
        socket.disconnect();
    }
}

/*
 * Read from DA node for recovery process.
 */
async function sendRecoveredTileResponse(socket: Socket, encTile: any) {
    if (socketIdDA == undefined || socket.id != socketIdDA) {
        socket.disconnect();
        return;
    }

    const ciphertext = encTile.ciphertext;
    const iv = encTile.iv;
    const tag = encTile.tag;

    if (!ciphertext || !iv || !tag) {
        return;
    }

    const tile = Tile.fromJSON(
        Utils.decryptTile(tileEncryptionKey, ciphertext, iv, tag)
    );

    // Push tile into state if it's hash has been emitted
    if (tile && hashHistory.has(tile.hash())) {
        if (!b.isSpawned(tile.owner)) {
            b.spawn(tile.loc, tile.owner, START_RESOURCES, tile.cityId);
            cityId++;
        } else {
            b.setTile(tile);
        }

        console.log(`Tile ${recoveryModeIndex}: success`);
    } else {
        console.error(`Tile ${recoveryModeIndex}: failure`);
    }

    // Request next tile
    recoveryModeIndex++;
    io.to(socketIdDA).emit("sendRecoveredTile", recoveryModeIndex);
}

/*
 * Continue to push encrypted tiles to DA node.
 */
function saveToDatabaseResponse(socket: Socket) {
    if (socketIdDA == undefined || socket.id != socketIdDA) {
        socket.disconnect();
        return;
    }
    dequeueTileIfDAConnected();
}

/*
 * Wrap-up function when DA reports a finished recovery.
 */
function finishRecovery(socket: Socket) {
    if (socketIdDA == undefined || socket.id != socketIdDA) {
        socket.disconnect();
        return;
    }
    console.log("Recovery finished");
    b.printView();

    // Enable play
    inRecoveryMode = false;
}

/*
 * Encrypt and enqueue tile.
 */
function enqueueTile(tile: Tile): EncryptedTile {
    const { ciphertext, iv, tag } = Utils.encryptTile(tileEncryptionKey, tile);
    const enc = {
        symbol: tile.owner.symbol,
        address: tile.owner.address,
        ciphertext,
        iv,
        tag,
    };
    queuedTilesDA.enqueue(enc);
    return enc;
}

/*
 * Submit encrypted tile to DA node to push into database.
 */
function dequeueTileIfDAConnected() {
    if (socketIdDA != undefined && queuedTilesDA.length > 0) {
        let encTile = queuedTilesDA.dequeue();
        io.to(socketIdDA).emit("saveToDatabase", encTile);
    }
}

/*
 * Callback function called on new block events. Deletes claimed moves that
 * are unresolved for too long.
 */
function upkeepClaimedMoves() {
    for (let [h, c] of claimedMoves.entries()) {
        if (currentBlockHeight > c.blockSubmitted + CLAIMED_MOVE_LIFE_SPAN) {
            claimedMoves.delete(h);
        }
    }
}

/*
 * Computes rand from the AES key. Rand is some randomness the enclave commits
 * to. In recovery mode it is crucial that rand is the same as in the enclave's
 * previous execution.
 */
function setRand() {
    rand = Utils.poseidonExt([
        BigInt("0x" + tileEncryptionKey.toString("hex")),
    ]);
    hRand = Utils.poseidonExt([rand]);
}

/*
 * Commit to enclave randomness, derived from AES key for DA.
 */
async function setEnclaveRandCommitment(nStates: any) {
    setRand();
    await nStates.write.setEnclaveRandCommitment([hRand.toString()]);
}

/*
 * Attach event handlers to a new connection.
 */
io.on("connection", (socket: Socket) => {
    console.log("Connected: ", socket.id);

    socket.on("login", (address: string, sig: string) => {
        login(socket, address, sig);
    });
    socket.on(
        "getSpawnSignature",
        async (symb: string, l: string, blind: string) => {
            sendSpawnSignature(socket, symb, l, blind);
        }
    );
    socket.on("handshakeDA", async () => {
        handshakeDA(socket);
    });
    socket.on(
        "getMoveSignature",
        async (uFrom: any, uTo: any, blind: string) => {
            sendMoveSignature(socket, uFrom, uTo, blind);
        }
    );
    socket.on("decrypt", (l: string) => {
        decrypt(socket, l);
    });
    // TODO : Explain this
    socket.on("sendRecoveredTileResponse", (encTile: any) => {
        sendRecoveredTileResponse(socket, encTile);
    });
    socket.on("recoveryFinished", () => {
        finishRecovery(socket);
    });
    socket.on("saveToDatabaseResponse", () => {
        saveToDatabaseResponse(socket);
    });
    socket.on("disconnecting", () => {
        disconnect(socket);
    });
});

/*
 * Event handler for NewSpawnAttempt event.
 */
publicClient.watchEvent({
    address: nStates.address,
    event: parseAbiItem(
        "event NewSpawnAttempt(address indexed player, bool indexed success)"
    ),
    strict: true,
    onLogs: (logs) =>
        logs.forEach((log) =>
            onSpawnAttempt(log.args.player, log.args.success)
        ),
});

/*
 * Event handler for NewMove event.
 */
publicClient.watchEvent({
    address: nStates.address,
    event: parseAbiItem(
        "event NewMove(uint256 indexed hUFrom, uint256 indexed hUTo)"
    ),
    strict: true,
    onLogs: (logs) =>
        logs.forEach((log) =>
            onMoveFinalize(log.args.hUFrom.toString(), log.args.hUTo.toString())
        ),
});

/*
 * Event handler for new blocks. Claimed moves that have been stored for too
 * long should be deleted.
 */
// TODO : Do we need this now? and also when it will run
publicClient.watchBlockNumber({
    onBlockNumber: (blockNumber) => {
        currentBlockHeight = blockNumber;
        upkeepClaimedMoves();
    },
});

/*
 * Start server & initialize game.
 */
server.listen(process.env.ENCLAVE_SERVER_PORT, async () => {
    fs.writeFileSync(`bin/proving_times_${ENCLAVE_STARTUP_TIMESTAMP}.txt`, "");

    b = new Board(terrainUtils);
    b.printView();

    if (inRecoveryMode) {
        // Get previous encryption key
        tileEncryptionKey = Buffer.from(
            fs.readFileSync(process.env.ENCRYPTION_KEY_PATH!, {
                encoding: "utf8",
            }),
            "hex"
        );

        // Compute and save rand, hRand from tileEncryptionKey
        setRand();

        // Cannot recover until DA node connects
        console.log("In recovery mode, waiting for DA node to connect");
    } else {
        // [TODO] wait for sufficient time post start up to get from PRNG

        // Generate and save encryption key
        tileEncryptionKey = Utils.genAESEncKey();

        fs.writeFileSync(
            process.env.ENCRYPTION_KEY_PATH!,
            tileEncryptionKey.toString("hex")
        );

        await setEnclaveRandCommitment(nStates);
    }

    console.log(
        `Server running on ${process.env.ENCLAVE_ADDRESS}:${process.env.ENCLAVE_SERVER_PORT}`
    );
});
