import {
    Board,
    Location,
    Player,
    ProverStatus,
    TerrainUtils,
    Tile,
    Utils,
} from "@seismic-systems/ns-fow-game";
import { exec as execCb } from "child_process";
import dotenv from "dotenv";
import express from "express";
import * as fs from "fs";
import http from "http";
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
    parseAbi,
    recoverMessageAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import {
    ClientToServerEvents,
    InterServerEvents,
    ServerToClientEvents,
    SocketData,
} from "../client/socket";
import IWorldAbi from "../contracts/out/IWorld.sol/IWorld.json" assert { type: "json" };
import worlds from "../contracts/worlds.json" assert { type: "json" };
import { ClaimedTileDAWrapper, EnclaveValuesDAWrapper } from "./DA";
dotenv.config({ path: "../.env" });
const exec = promisify(execCb);

/*
 * Proving times saved into `bin/proving_times_${ENCLAVE_STARTUP_TIMESTAMP}.txt`
 */
const ENCLAVE_STARTUP_TIMESTAMP = new Date()
    .toISOString()
    .replace(/[:.-]/g, "");

/*
 * Whether the enclave's global state should be blank or pull from DA.
 */
let inRecoveryMode = process.argv[2] == "1";

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
const account = privateKeyToAccount(process.env.PRIVATE_KEY as Address);
const abi = IWorldAbi.abi;

const walletClient = createWalletClient({
    account,
    chain,
    transport: httpTransport(process.env.RPC_URL),
});

const publicClient = createPublicClient({
    chain,
    transport: httpTransport(process.env.RPC_URL),
    pollingInterval: 100,
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
 * Using Socket.IO to manage communication to clients.
 */
const app = express();
app.use(express.json());

// [TODO]: add auth to all endpoints
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

console.log("- Warning: currently accepting requests from all origins");
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

/*
 * Enclave's internal belief on game state stored in Board object.
 */
let b: Board;

/*
 * Bijection between player's public keys and their socket IDs.
 */
let idToAddress = new Map<string, string>();
let addressToId = new Map<string, string>();

/*
 * Record of challenges submitted to clients for authentication.
 */
let socketChallenges = new Map<string, string>();

/*
 * Current block height. Storing the value in a variable saves from
 * unnecessarily indexing twice.
 */
let currentBlockHeight: bigint;

let latestBlockSynced: bigint =
    worldData.blockNumber !== undefined ? BigInt(worldData.blockNumber) : 0n;

let syncMode: boolean = false;

/*
 * Latest block height players proposed a move.
 */
let playerLatestBlock = new Map<string, bigint>();

/*
 * Encryption key for global state sent to DA.
 */
let tileEncryptionKey: Buffer;

function socketChallenge(socket: Socket) {
    if (inRecoveryMode) {
        socket.disconnect();
        return;
    }

    if (socketChallenges.has(socket.id)) {
        socket.emit("challengeResponse", socketChallenges.get(socket.id));
        return;
    }

    const challenge = Utils.genRandomInt().toString();
    socketChallenges.set(socket.id, challenge);
    socket.emit("challengeResponse", challenge);
}

/*
 * If player is already spawned, return visible tiles for decryption. If not,
 * tell player to initiate spawning.
 */
async function login(socket: Socket, sig: string) {
    if (inRecoveryMode) {
        socket.disconnect();
        return;
    }

    let challenge = socketChallenges.get(socket.id);
    if (!challenge) {
        console.log("- Request challenge first");
        socket.disconnect();
        return;
    }

    let address: string | undefined;
    try {
        address = await recoverMessageAddress({
            message: challenge,
            signature: sig as Address,
        });
    } catch (error) {
        console.log("- Malignant signature", sig);
        socket.disconnect();
        return;
    }

    if (!address) {
        console.log("- Bad challenge signature");
        socket.disconnect();
        return;
    }

    socketChallenges.delete(socket.id);

    idToAddress.set(socket.id, address);
    addressToId.set(address, socket.id);

    if (b.isSpawned(new Player("", address))) {
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

    playerLatestBlock.set(address, 0n);
}

/*
 * Propose to spawn at location l. Returns a signature of the old and new tiles
 * at location for contract to verify, or null value if player cannot spawn at
 * this location.
 */
async function sendSpawnSignature(socket: Socket, symbol: string, l: string) {
    const sender = idToAddress.get(socket.id);
    if (inRecoveryMode || !sender) {
        socket.disconnect();
        return;
    }

    if (b.isSpawned(new Player("", sender))) {
        console.log(`- Address ${sender} already spawned`);
        socket.disconnect();
        return;
    }

    const latestBlock = playerLatestBlock.get(sender);
    if (latestBlock === undefined || latestBlock === currentBlockHeight) {
        console.log(
            `- Address ${sender} must wait before trying to spawn again`
        );
        socket.disconnect();
        return;
    }

    let loc: Location | undefined;
    try {
        loc = Utils.unstringifyLocation(l);
    } catch (error) {
        console.log("- Malignant location string: ", l);
        socket.disconnect();
    }

    if (!loc) {
        console.log("- Location is undefined");
        return;
    }

    const virtTile = b.getTile(loc, rand);
    if (!virtTile || !virtTile.isSpawnable()) {
        console.log("- Tile cannot be spawned on");
        socket.emit("trySpawn");
        return;
    }

    // Pair the public key and the socket ID
    idToAddress.set(socket.id, sender);
    addressToId.set(sender, socket.id);

    // Generate a random 24-bit number for city ID
    const genCityId = Math.floor(Math.random() * 0xffffff);

    const spawnTile = Tile.spawn(
        new Player(symbol, sender),
        loc,
        START_RESOURCES,
        genCityId
    );
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

    // allow player to try to spawn
    playerLatestBlock.set(sender, currentBlockHeight);

    await ClaimedTileDAWrapper.saveClaimedTile(spawnTile);
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
        console.log(`- Proving virtual ZKP with ID = ${proofId}`);
        const startTime = Date.now();
        await exec(`../enclave/scripts/virtual-prover.sh ${proofId}`);
        const endTime = Date.now();

        const proverTime = endTime - startTime;
        console.log(`- virtual-prover.sh finished in ${proverTime} ms`);

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
        console.error(`- Error: ${error}`);
    }

    if (proverStatus === ProverStatus.Incomplete) {
        try {
            // If rapidsnark fails, run snarkjs prover
            console.log(`- Proving virtual ZKP with snarkjs`);
            const startTime = Date.now();
            [proof, publicSignals] = await Tile.virtualZKP(inputs);
            const endTime = Date.now();

            const proverTime = endTime - startTime;
            console.log(`- snarkjs finished in ${proverTime} ms`);

            proverStatus = ProverStatus.Snarkjs;
        } catch (error) {
            console.error(`- Error: ${error}`);
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

        await ClaimedTileDAWrapper.saveClaimedTile(uFromAsTile);
        await ClaimedTileDAWrapper.saveClaimedTile(uToAsTile);
    } else {
        // Cut the connection
        socket.disconnect();
    }
}

/*
 * Exposes secrets at location l if a requesting player proves ownership of
 * neighboring tile.
 */
async function decrypt(socket: Socket, l: string) {
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
    console.log("- Disconnected: ", socket.id);
}

/*
 * Callback function for when a NewSpawnAttempt event is emitted. Event is
 * emitted when a player tries to spawn in, whether or not they can. After
 * doing so, they should be allowed to try to spawn again.
 */
async function onSpawnAttempt(
    player: string,
    hSpawn: string,
    success: boolean
) {
    const spawnTile = await ClaimedTileDAWrapper.getClaimedTile(hSpawn);

    if (!spawnTile) {
        console.error(`- Spawn with hash ${hSpawn} finalized with no preimage`);
        return;
    }

    // Update state even if player is not currently connected
    if (success) {
        b.setTile(spawnTile);
    }

    // Let player move or try to spawn again
    playerLatestBlock.set(player, 0n);

    const socketId = addressToId.get(player);

    if (!socketId) {
        return;
    }

    // socketID exists -> player is connected
    if (success) {
        const visibleLocs = b
            .getNearbyLocations(spawnTile.loc)
            .map((loc) => Utils.stringifyLocation(loc));

        io.to(socketId).emit("loginResponse", visibleLocs);
    } else {
        io.to(socketId).emit("trySpawn");
    }
}

/*
 * Callback function for when a NewMove event is emitted. Reads claimed move
 * into enclave's internal beliefs, and alerts players in range to decrypt.
 */
async function onMoveFinalize(hUFrom: string, hUTo: string) {
    const uFrom = await ClaimedTileDAWrapper.getClaimedTile(hUFrom);
    if (!uFrom) {
        console.error(`- Tile with hash ${hUFrom} finalized with no preimage`);
        return;
    }
    const uTo = await ClaimedTileDAWrapper.getClaimedTile(hUTo);
    if (!uTo) {
        console.error(`- Tile with hash ${hUTo} finalized with no preimage`);
        return;
    }

    const tTo = b.getTile(uTo.loc, rand);
    if (!tTo) {
        // uTo cannot be out-of-bounds if verification passed
        return;
    }

    const newOwner = uTo.owner.address;
    const prevOwner = tTo.owner.address;
    const ownershipChanged = prevOwner !== newOwner;

    // Alert all nearby players that an updateDisplay is needed
    let updatedLocs = [uFrom.loc];
    if (ownershipChanged && tTo.isCityCenter()) {
        b.cityTiles.get(tTo.cityId)?.forEach((locString: string) => {
            const loc = Utils.unstringifyLocation(locString);
            if (loc) {
                updatedLocs.push(loc);
            }
        });
    } else {
        updatedLocs.push(uTo.loc);
    }

    b.setTile(uFrom);
    b.setTile(uTo);

    alertPlayers(newOwner, prevOwner, updatedLocs);
}

/*
 * Helper function for onMoveFinalize. Pings players when locations should be
 * decrypted. For each location in updatedLocs, the previous and new owner
 * decrypt all tiles in the 3x3 region, and nearby players decrypt the tile in
 * updatedLocs.
 */
async function alertPlayers(
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
 * Computes rand from the AES key. Rand is some randomness the enclave commits
 * to. In recovery mode it is crucial that rand is the same as in the enclave's
 * previous execution, and that different enclave instances are synced on rand.
 */
async function setEnclaveBlindIfBlank() {
    const res = await EnclaveValuesDAWrapper.getEnclaveBlind();
    if (res === undefined) {
        rand = Utils.genRandomInt();
        EnclaveValuesDAWrapper.setEnclaveBlind(rand.toString());
    } else {
        rand = res;
    }

    // Ensure contract and enclave are synced, even if rand is saved locally
    hRand = Utils.poseidonExt([rand]);
    await nStates.write.setEnclaveRandCommitment([hRand.toString()]);
}

/*
 * Attach event handlers to a new connection.
 */
io.on("connection", (socket: Socket) => {
    console.log("- Connected: ", socket.id);

    socket.on("challenge", () => {
        socketChallenge(socket);
    });
    socket.on("login", (sig: string) => {
        login(socket, sig);
    });
    socket.on("getSpawnSignature", async (symb: string, l: string) => {
        await sendSpawnSignature(socket, symb, l);
    });
    socket.on(
        "getMoveSignature",
        async (uFrom: any, uTo: any, blind: string) => {
            await sendMoveSignature(socket, uFrom, uTo, blind);
        }
    );
    socket.on("decrypt", async (l: string) => {
        await decrypt(socket, l);
    });
    socket.on("disconnecting", () => {
        disconnect(socket);
    });
});

/*
 * Event handler for new blocks. Claimed moves that have been stored for too
 * long should be deleted.
 */
publicClient.watchBlockNumber({
    onBlockNumber: async (blockNumber) => {
        currentBlockHeight = blockNumber;

        if (syncMode) {
            return;
        }
        syncMode = true;

        const logs = await publicClient.getLogs({
            address: worldAddress,
            events: parseAbi([
                "event NewSpawnAttempt(address indexed player, uint256 indexed hSpawn, bool indexed success)",
                "event NewMove(uint256 indexed hUFrom, uint256 indexed hUTo)",
            ]),
            strict: true,
            fromBlock: latestBlockSynced + 1n,
            toBlock: blockNumber,
        });

        for (const log of logs) {
            if (log.eventName === "NewSpawnAttempt") {
                await onSpawnAttempt(
                    log.args.player,
                    log.args.hSpawn.toString(),
                    log.args.success
                );
            } else if (log.eventName === "NewMove") {
                await onMoveFinalize(
                    log.args.hUFrom.toString(),
                    log.args.hUTo.toString()
                );
            }
        }

        syncMode = false;
        latestBlockSynced = blockNumber;
    },
});

/*
 * Start server & initialize game.
 */
server.listen(process.env.ENCLAVE_SERVER_PORT, async () => {
    fs.writeFileSync(`bin/proving_times_${ENCLAVE_STARTUP_TIMESTAMP}.txt`, "");

    b = new Board(terrainUtils);
    b.printView();

    await setEnclaveBlindIfBlank();

    console.log(
        `- Server running on ${process.env.ENCLAVE_ADDRESS}:${process.env.ENCLAVE_SERVER_PORT}`
    );
});
