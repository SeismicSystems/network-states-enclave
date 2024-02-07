import { io } from "socket.io-client";
import dotenv from "dotenv";
import {
    Account,
    Address,
    createPublicClient,
    createWalletClient,
    defineChain,
    getContract,
    hexToSignature,
    http as httpTransport,
    parseEther,
} from "viem";
import { foundry } from "viem/chains";
import IWorldAbi from "../contracts/out/IWorld.sol/IWorld.json" assert { type: "json" };
import worlds from "../contracts/worlds.json" assert { type: "json" };
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
    Utils,
    Board,
    TerrainUtils,
    ProverStatus,
    Tile,
    Player,
    Location,
} from "@seismic-sys/ns-fow-game";
dotenv.config({ path: "../.env" });

const endpoint = `${process.env.ENCLAVE_ADDRESS}:${process.env.ENCLAVE_SERVER_PORT}`;
const numConnections = process.argv[2] ? parseInt(process.argv[2], 10) : 1;
const MOVES = ["w", "a", "s", "d"];
const MOVE_KEYS: Record<string, number[]> = {
    w: [-1, 0],
    a: [0, -1],
    s: [1, 0],
    d: [0, 1],
};

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
const abi = IWorldAbi.abi;

async function testSocketFunction(account: Account, id: number) {
    const terrainCache = new TerrainUtils(2, 2, 19, 18, 17);
    const b = new Board(terrainCache);

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

    const PLAYER = new Player("", account.address);
    let PLAYER_SPAWN: Location;
    let spawnTile: Tile;
    let currentLoc: Location;
    let nextLoc: Location;
    let moveFormattedProof: any;
    let uFromSaved: Tile;
    let uToSaved: Tile;

    // Your socket function logic goes here
    // For example: Connect to socket, perform operations, and disconnect
    const socket = io(endpoint);

    // Add your socket operation logic here
    socket.emit("challenge");

    socket.on("challengeResponse", async (challenge: string) => {
        const sig = await walletClient.signMessage({ message: challenge });
        socket.emit("login", sig);
    });

    socket.on("trySpawn", async () => {
        PLAYER_SPAWN = {
            r: Math.floor(Math.random() * 1000),
            c: Math.floor(Math.random() * 1000),
        };

        socket.emit(
            "getSpawnSignature",
            "",
            Utils.stringifyLocation(PLAYER_SPAWN)
        );
    });

    socket.on(
        "spawnSignatureResponse",
        async (
            virt: any,
            spawn: any,
            sig: string,
            virtPrf: any,
            virtPubSigs: any,
            proverStatus: ProverStatus
        ) => {
            const virtTile = Tile.fromJSON(virt);
            spawnTile = Tile.fromJSON(spawn);

            const virtFormattedProof = await Utils.exportCallDataGroth16(
                virtPrf,
                virtPubSigs
            );
            const [virtInputs, virtProof] =
                Utils.unpackVirtualInputs(virtFormattedProof);

            const [prf, pubSigs] = await Tile.spawnZKP(
                PLAYER,
                virtTile,
                spawnTile
            );

            const spawnFormattedProof = await Utils.exportCallDataGroth16(
                prf,
                pubSigs
            );
            const [spawnInputs, spawnProof] =
                Utils.unpackSpawnInputs(spawnFormattedProof);
            const unpackedSig = hexToSignature(sig as Address);
            const spawnSig = {
                v: unpackedSig.v,
                r: unpackedSig.r,
                s: unpackedSig.s,
                b: 0,
            };

            await nStates.write.spawn([
                spawnInputs,
                spawnProof,
                virtInputs,
                virtProof,
                spawnSig,
            ]);
        }
    );

    socket.on("loginResponse", async (visibleLoc: string[]) => {
        console.log(`- Player #${id} spawned`);
        b.setTile(spawnTile);
        currentLoc = PLAYER_SPAWN;

        // pick and save move direction
        do {
            const nextMove = MOVES[Math.floor(Math.random() * 4)];
            const moveDelta = MOVE_KEYS[nextMove];
            nextLoc = {
                r: PLAYER_SPAWN.r + moveDelta[0],
                c: PLAYER_SPAWN.c + moveDelta[1],
            };
        } while (b.getTile(nextLoc, BigInt(0))?.isHill());

        socket.emit("decrypt", Utils.stringifyLocation(nextLoc));
    });

    socket.on("decryptResponse", async (t: any) => {
        // save tile into state
        const tl = Tile.fromJSON(t);
        b.setTile(tl);

        // move
        let [uFrom, uTo, moveZKPPromise] = await b.moveZKP(
            currentLoc,
            nextLoc,
            nStates
        );

        moveZKPPromise
            .then(async (moveRes) => {
                moveFormattedProof = await Utils.exportCallDataGroth16(
                    moveRes.proof,
                    moveRes.publicSignals
                );

                uFromSaved = uFrom;
                uToSaved = uTo;

                socket.emit(
                    "getMoveSignature",
                    uFrom,
                    uTo,
                    PLAYER.blind.toString()
                );
            })
            .catch(async (error) => {
                console.error(error);

                // TODO: pick a new direction
            });
    });

    socket.on(
        "moveSignatureResponse",
        async (
            sig: string,
            blockNumber: string,
            virtPrf: any,
            virtPubSigs: any,
            proverStatus: ProverStatus
        ) => {
            const virtualFormattedProof = await Utils.exportCallDataGroth16(
                virtPrf,
                virtPubSigs
            );
            const unpackedSig = hexToSignature(sig as Address);
            const enclaveSig = {
                v: unpackedSig.v,
                r: unpackedSig.r,
                s: unpackedSig.s,
                b: blockNumber,
            };

            const [moveInputs, moveProof] =
                Utils.unpackMoveInputs(moveFormattedProof);
            const [virtInputs, virtProof] = Utils.unpackVirtualInputs(
                virtualFormattedProof
            );

            try {
                const tx = await nStates.write.move([
                    moveInputs,
                    moveProof,
                    virtInputs,
                    virtProof,
                    enclaveSig,
                ]);
                b.setTile(uFromSaved);
                b.setTile(uToSaved);
                currentLoc = nextLoc;
            } catch (error) {
                socket.disconnect();
                console.log(
                    `- Player #${id} disonnected from error calling move()`
                );
                return;
            }
        }
    );

    socket.on("updateDisplay", async (locs: string[]) => {
        console.log(`- Player #${id} moved`);
        // move again
        do {
            const nextMove = MOVES[Math.floor(Math.random() * 4)];
            const moveDelta = MOVE_KEYS[nextMove];
            nextLoc = {
                r: currentLoc.r + moveDelta[0],
                c: currentLoc.c + moveDelta[1],
            };
        } while (b.getTile(nextLoc, BigInt(0))?.isHill());

        socket.emit("decrypt", Utils.stringifyLocation(nextLoc));
    });
}

async function runLoadTest() {
    // Init
    const anvilWalletClient = createWalletClient({
        account: privateKeyToAccount(
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        ),
        chain,
        transport: httpTransport(process.env.RPC_URL),
    });

    const accounts = Array.from({ length: numConnections }, () =>
        privateKeyToAccount(generatePrivateKey())
    );

    const promises = [];

    for (let i = 0; i < numConnections; i++) {
        const account = accounts[i];

        // Send ETH from default anvil account to all priv keys
        await anvilWalletClient.sendTransaction({
            to: account.address,
            value: parseEther("0.1"),
        });

        promises.push(testSocketFunction(account, i));
    }

    await Promise.all(promises);
}

runLoadTest();
