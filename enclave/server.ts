import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { ethers, utils } from "ethers";
import * as fs from "fs";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
} from "./socket";
import { Queue } from "queue-typescript";
import { Tile, Player, Board, Location, Utils } from "../game";

/*
 * Whether the enclave's global state should be blank or pull from DA.
 */
const inRecoveryMode = process.argv[2] == "1";

/*
 * Set game parameters and create dummy players.
 */
const BOARD_SIZE: number = parseInt(<string>process.env.BOARD_SIZE, 10);
const START_RESOURCES: number = parseInt(
    <string>process.env.START_RESOURCES,
    10
);

/*
 * Number of blocks that a claimed move is allowed to be pending without being
 * deleted.
 */
const CLAIMED_MOVE_LIFE_SPAN = parseInt(
    <string>process.env.CLAIMED_MOVE_LIFE_SPAN,
    10
);

/*
 * Using Socket.IO to manage communication to clients.
 */
const app = express();
const server = http.createServer(app);
const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>(server);

/*
 * Boot up interface with Network States contract.
 */
const signer = new ethers.Wallet(
    <string>process.env.DEV_PRIV_KEY,
    new ethers.providers.JsonRpcProvider(process.env.RPC_URL)
);
const nStates = new ethers.Contract(
    <string>process.env.CONTRACT_ADDR,
    require(<string>process.env.CONTRACT_ABI).abi,
    signer
);

type ClaimedMove = {
    uFrom: Tile;
    uTo: Tile;
    blockSubmitted: number;
    uFromEnc: EncryptedTile;
    uToEnc: EncryptedTile;
};

type EncryptedTile = {
    symbol: string;
    pubkey: string;
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
let idToPubKey = new Map<string, string>();
let pubKeyToId = new Map<string, string>();

/*
 * Moves claimed by players. A move is finalized whenever NewMove event is
 * emitted.
 */
let claimedMoves = new Map<string, ClaimedMove>();

/*
 * Current block height. Storing the value in a variable saves from
 * unnecessarily indexing twice.
 */
let currentBlockHeight: number;

/*
 * Latest block height players proposed a move.
 */
let playerLatestBlock = new Map<string, number>();

/*
 * Encryption key for global state sent to DA.
 */
let tileEncryptionKey: Buffer;

/*
 * Socket ID of DA node.
 */
let daSocketId: string | undefined;

/*
 * Queue of claimed new tile states that have yet to be pushed to DA.
 */
let encryptedTiles = new Queue<EncryptedTile>();

/*
 * Index for retrieving encrypted tiles from DA node.
 */
let recoveryModeIndex = 0;

/*
 * Dev function for spawning a player on the map or logging back in.
 *
 * [TODO]: the enclave should not be calling the contract's spawn
 * function on behalf of the player. In prod, client will sample cityId.
 */
async function login(
    socket: Socket,
    l: Location,
    reqPlayer: Player,
    sigStr: string
) {
    const h = Player.hForLogin(Utils.asciiIntoBigNumber(socket.id));
    const sig = Utils.unserializeSig(sigStr);
    if (sig && reqPlayer.verifySig(h, sig)) {
        const pubkey = reqPlayer.bjjPub.serialize();

        // Spawn if player is connected for the first time
        if (!b.isSpawned(reqPlayer)) {
            await b.spawn(l, reqPlayer, START_RESOURCES, cityId, nStates);
            cityId++;
            enqueueTile(b.getTile(l));
        }

        // Attempt to push encrypted tiles to DA
        dequeueTile();

        // Pair the public key and the socket ID
        idToPubKey.set(socket.id, pubkey);
        pubKeyToId.set(pubkey, socket.id);

        playerLatestBlock.set(pubkey, 0);

        let visibleTiles = new Set<string>();
        b.playerCities.get(pubkey)?.forEach((cityId: number) => {
            b.cityTiles.get(cityId)?.forEach((locString: string) => {
                const tl = Tile.unstringifyLocation(locString);
                if (tl) {
                    for (let loc of b.getNearbyLocations(tl)) {
                        visibleTiles.add(Tile.stringifyLocation(loc));
                    }
                }
            });
        });
        socket.emit("loginResponse", Array.from(visibleTiles));
    }
}

/*
 * Sets the socket ID of the DA node, if not already set. Sends back
 * inRecoveryMode variable.
 */
function handshakeDA(socket: Socket) {
    if (daSocketId == undefined) {
        daSocketId = socket.id;
        io.to(daSocketId).emit("handshakeDAResponse", inRecoveryMode);
    } else {
        disconnect(socket);
    }
}

async function recoverTileResponse(
    socket: Socket,
    symbol: string,
    pubkey: string,
    ciphertext: string,
    iv: string,
    tag: string
) {
    // TODO: save to board
    const tileString = Utils.decryptTile(
        tileEncryptionKey,
        ciphertext,
        iv,
        tag
    );
    const tile = Tile.unStringifyTile(symbol, pubkey, tileString);
    if (tile) {
        if (!b.isSpawned(tile.owner)) {
            b.spawn(
                tile.loc,
                tile.owner,
                START_RESOURCES,
                tile.cityId,
                undefined
            );
            cityId++;
        } else {
            b.setTile(tile);
        }
    }

    // [TODO]: first, check if tile hash is on chain. Only if so, then 

    // Request next tile
    recoveryModeIndex++;
    socket.emit("recoverTile", recoveryModeIndex);
}

/*
 * Encrypt and enqueue tile.
 */
function enqueueTile(tile: Tile): EncryptedTile {
    const { ciphertext, iv, tag } = Utils.encryptTile(tileEncryptionKey, tile);
    const enc = {
        symbol: tile.owner.symbol,
        pubkey: tile.ownerPubKey(),
        ciphertext,
        iv,
        tag,
    };
    encryptedTiles.enqueue(enc);
    return enc;
}

/*
 * Submit encrypted tile to DA node to push into database.
 */
function dequeueTile() {
    if (daSocketId != undefined && encryptedTiles.length > 0) {
        let encTile = encryptedTiles.dequeue();
        io.to(daSocketId).emit(
            "pushToDA",
            encTile.symbol,
            encTile.pubkey,
            encTile.ciphertext,
            encTile.iv,
            encTile.tag
        );
    }
}

/*
 * Propose move to enclave. In order for the move to be solidified, the enclave
 * must respond to a leaf event.
 */
async function getSignature(socket: Socket, uFrom: any, uTo: any) {
    const pubkey = idToPubKey.get(socket.id);
    if (!pubkey) {
        // Cut the connection
        disconnect(socket);
    } else {
        // Players cannot make more than one move per block
        const latestBlock = playerLatestBlock.get(pubkey);
        if (latestBlock != undefined && latestBlock < currentBlockHeight) {
            const uFromAsTile = Tile.fromJSON(uFrom);
            const hUFrom = uFromAsTile.hash();
            const uToAsTile = Tile.fromJSON(uTo);
            const hUTo = uToAsTile.hash();

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

            const digest = utils.solidityKeccak256(
                ["uint256", "uint256", "uint256"],
                [currentBlockHeight, hUFrom, hUTo]
            );
            const sig = await signer.signMessage(utils.arrayify(digest));

            socket.emit("signatureResponse", sig, currentBlockHeight);
            playerLatestBlock.set(pubkey, currentBlockHeight);

            // Clear queue if DA node is online
            dequeueTile();
        } else {
            // Cut the connection
            disconnect(socket);
        }
    }
}

/*
 * Exposes secrets at location l if a requesting player proves ownership of
 * neighboring tile.
 */
function decrypt(
    socket: Socket,
    l: Location,
    reqPlayer: Player,
    sigStr: string
) {
    const h = Player.hForDecrypt(l);
    const sig = Utils.unserializeSig(sigStr);
    if (sig && reqPlayer.verifySig(h, sig) && b.noFog(l, reqPlayer)) {
        socket.emit("decryptResponse", b.getTile(l).toJSON());
        return;
    }
    socket.emit("decryptResponse", Tile.mystery(l).toJSON());
}

/*
 * When a player disconnects, we remove the relation between their socket ID and
 * their public key. This is so that no other player gains that ID and can play
 * on their behalf.
 */
function disconnect(socket: Socket) {
    const pubKey = idToPubKey.get(socket.id);
    if (pubKey) {
        pubKeyToId.delete(pubKey);
        idToPubKey.delete(socket.id);
    }
    if (daSocketId == socket.id) {
        daSocketId = undefined;
    }
}

/*
 * Callback function for when a NewMove event is emitted. Reads claimed move
 * into enclave's internal beliefs, and alerts players in range to decrypt.
 */
function onMoveFinalize(hUFrom: string, hUTo: string) {
    const moveHash = hUFrom.concat(hUTo);
    const move = claimedMoves.get(moveHash);
    if (move) {
        // Move is no longer pending
        claimedMoves.delete(moveHash);

        // Before state is updated, we need the previous 'to' tile owner
        const tTo = b.getTile(move.uTo.loc);
        const newOwner = move.uTo.ownerPubKey();
        const prevOwner = tTo.ownerPubKey();
        const ownershipChanged = prevOwner !== newOwner;

        // Alert all nearby players that an updateDisplay is needed
        let updatedLocs = [move.uFrom.loc];
        if (ownershipChanged && tTo.isCapital()) {
            b.playerCities.get(prevOwner)?.forEach((cityId: number) => {
                b.cityTiles.get(cityId)?.forEach((locString: string) => {
                    const loc = Tile.unstringifyLocation(locString);
                    if (loc) {
                        updatedLocs.push(loc);
                    }
                });
            });
        } else if (ownershipChanged && tTo.isCity()) {
            b.cityTiles.get(tTo.cityId)?.forEach((locString: string) => {
                const loc = Tile.unstringifyLocation(locString);
                if (loc) {
                    updatedLocs.push(loc);
                }
            });
        } else {
            updatedLocs.push(move.uTo.loc);
        }

        // Update state
        b.setTile(move.uFrom);
        b.setTile(move.uTo);

        alertPlayers(newOwner, prevOwner, updatedLocs);
    } else {
        console.log(
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
        const locString = Tile.stringifyLocation(loc);
        for (let l of b.getNearbyLocations(loc)) {
            const tileOwner = b.getTile(l).ownerPubKey();
            const lString = Tile.stringifyLocation(l);

            if (!alertPlayerMap.has(tileOwner)) {
                alertPlayerMap.set(tileOwner, new Set<string>());
            }
            alertPlayerMap.get(tileOwner)?.add(locString);
            alertPlayerMap.get(newOwner)?.add(lString);
            alertPlayerMap.get(prevOwner)?.add(lString);
        }
    }

    alertPlayerMap.forEach((tiles: Set<string>, pubkey: string) => {
        const socketId = pubKeyToId.get(pubkey);
        if (socketId) {
            io.to(socketId).emit("updateDisplay", Array.from(tiles));
        }
    });
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
 * Attach event handlers to a new connection.
 */
io.on("connection", (socket: Socket) => {
    console.log("Client connected: ", socket.id);

    socket.on("login", (l: Location, p: string, s: string, sig: string) => {
        login(socket, l, Player.fromPubString(s, p), sig);
    });
    socket.on("handshakeDA", () => {
        handshakeDA(socket);
    });
    socket.on("getSignature", (uFrom: any, uTo: any) => {
        getSignature(socket, uFrom, uTo);
    });
    socket.on("decrypt", (l: Location, pubkey: string, sig: string) => {
        decrypt(socket, l, Player.fromPubString("", pubkey), sig);
    });
    socket.on(
        "recoverTileResponse",
        (
            symbol: string,
            pubkey: string,
            ciphertext: string,
            iv: string,
            tag: string
        ) => {
            recoverTileResponse(socket, symbol, pubkey, ciphertext, iv, tag);
        }
    );
    socket.on("recoveryFinished", () => {
        // TODO: finish this
        recoveryModeIndex = 0;
        console.log("recovery finished");
    });
    socket.on("pushToDAResponse", () => {
        dequeueTile();
    });
    socket.on("disconnecting", () => {
        disconnect(socket);
    });
});

/*
 * Event handler for NewMove event. io is passed in so that we can ping players.
 */
nStates.on(nStates.filters.NewMove(), (hUFrom, hUTo) => {
    onMoveFinalize(hUFrom.toString(), hUTo.toString());
});

/*
 * Event handler for new blocks. Claimed moves that have been stored for too
 * long should be deleted.
 */
nStates.provider.on("block", async (n) => {
    currentBlockHeight = n;
    upkeepClaimedMoves();
});

/*
 * Start server & initialize game.
 */
server.listen(process.env.ENCLAVE_SERVER_PORT, async () => {
    b = new Board();

    if (inRecoveryMode) {
        // Get previous encryption key
        tileEncryptionKey = Buffer.from(
            fs.readFileSync(process.env.ENCRYPTION_KEY_PATH!, {
                encoding: "utf8",
            }),
            "hex"
        );

        // Seed board, but do not update global state
        await b.seed(BOARD_SIZE, true, undefined);

        // Cannot recover until DA node connects
        console.log("In recovery mode, waiting for DA node to connect");
    } else {
        // Generate and save encryption key
        tileEncryptionKey = Utils.genAESEncKey();
        fs.writeFileSync(
            process.env.ENCRYPTION_KEY_PATH!,
            tileEncryptionKey.toString("hex")
        );

        await b.seed(BOARD_SIZE, true, nStates);

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                enqueueTile(b.t[r][c]);
            }
        }
    }

    console.log(
        `Server running on http://localhost:${process.env.ENCLAVE_SERVER_PORT}`
    );
});
