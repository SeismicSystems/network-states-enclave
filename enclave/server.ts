import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { ethers, utils } from "ethers";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
} from "./socket";
import { Tile, Player, Board, Location, Utils } from "../game";

/*
 * Set game parameters and create dummy players.
 */
const BOARD_SIZE: number = parseInt(<string>process.env.BOARD_SIZE, 10);
const START_RESOURCES: number = parseInt(
    <string>process.env.START_RESOURCES,
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
};

/*
 * Enclave's internal belief on game state stored in Board object.
 */
let b: Board;

/*
 * City ID given to each spawning player. Increments by one each time.
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
        }

        // Pair the public key and the socket ID
        idToPubKey.set(socket.id, pubkey);
        pubKeyToId.set(pubkey, socket.id);

        let visibleTiles = new Map<string, boolean>();
        b.playerCities
            .get(pubkey)
            ?.forEach((_value: boolean, cityId: number) => {
                b.cityTiles.get(cityId)?.forEach((_v: boolean, key: string) => {
                    const tl = Utils.unstringifyLocation(key);
                    if (tl) {
                        for (let loc of b.getNearbyLocations(tl)) {
                            visibleTiles.set(
                                Utils.stringifyLocation(loc),
                                true
                            );
                        }
                    }
                });
            });
        socket.emit("loginResponse", Array.from(visibleTiles.keys()));
    }
}

/*
 * Propose move to enclave. In order for the move to be solidified, the enclave
 * must respond to a leaf event.
 */
async function getSignature(socket: Socket, uFrom: any, uTo: any) {
    const uFromAsTile = Tile.fromJSON(uFrom);
    const hUFrom = uFromAsTile.hash();
    const uToAsTile = Tile.fromJSON(uTo);
    const hUTo = uToAsTile.hash();

    claimedMoves.set(hUFrom.concat(hUTo), {
        uFrom: uFromAsTile,
        uTo: uToAsTile,
    });

    const digest = utils.solidityKeccak256(
        ["uint256", "uint256"],
        [hUFrom, hUTo]
    );
    const sig = await signer.signMessage(utils.arrayify(digest));

    socket.emit("getSignatureResponse", sig, uFrom, uTo);
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
function disconnectPlayer(socket: Socket) {
    const pubKey = idToPubKey.get(socket.id);
    if (pubKey) {
        pubKeyToId.delete(pubKey);
        idToPubKey.delete(socket.id);
    }
}

/*
 * Callback function for when a NewMove event is emitted. Reads claimed move
 * into enclave's internal beliefs, and alerts players in range to decrypt.
 */
function onMoveFinalize(io: Server, hUFrom: string, hUTo: string) {
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
            b.playerCities
                .get(prevOwner)
                ?.forEach((_: boolean, cityId: number) => {
                    b.cityTiles
                        .get(cityId)
                        ?.forEach((_: boolean, locString: string) => {
                            const loc = Utils.unstringifyLocation(locString);
                            if (loc) {
                                updatedLocs.push(loc);
                            }
                        });
                });
        } else if (ownershipChanged && tTo.isCity()) {
            b.cityTiles
                .get(tTo.cityId)
                ?.forEach((_: boolean, locString: string) => {
                    const loc = Utils.unstringifyLocation(locString);
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

        alertPlayers(io, newOwner, prevOwner, updatedLocs);
    } else {
        console.log(
            `Move: (${hUFrom}, ${hUTo}) was finalized without a signature.`
        );
    }

    console.log("==player capitals: ", b.playerCapital);
    console.log("==player cities: ", b.playerCities);
    console.log("== city tiles: ", b.cityTiles);
}

/*
 * Helper function for onMoveFinalize. Pings players when locations should be
 * decrypted. For each location in updatedLocs, the previous and new owner
 * decrypt all tiles in the 3x3 region, and nearby players decrypt the tile in
 * updatedLocs.
 */
function alertPlayers(
    io: Server,
    newOwner: string,
    prevOwner: string,
    updatedLocs: Location[]
) {
    let alertPlayerMap = new Map<string, Map<string, boolean>>();

    for (let loc of updatedLocs) {
        const locString = Utils.stringifyLocation(loc);
        for (let l of b.getNearbyLocations(loc)) {
            const tileOwner = b.getTile(l).ownerPubKey();
            const lString = Utils.stringifyLocation(l);

            if (!alertPlayerMap.has(tileOwner)) {
                alertPlayerMap.set(tileOwner, new Map<string, boolean>());
            }
            alertPlayerMap.get(tileOwner)?.set(locString, true);
            alertPlayerMap.get(newOwner)?.set(lString, true);
            alertPlayerMap.get(prevOwner)?.set(lString, true);
        }
    }

    alertPlayerMap.forEach((tiles: Map<string, boolean>, pubkey: string) => {
        const socketId = pubKeyToId.get(pubkey);
        if (socketId) {
            io.to(socketId).emit("updateDisplay", Array.from(tiles.keys()));
        }
    });
}

/*
 * Attach event handlers to a new connection.
 */
io.on("connection", (socket: Socket) => {
    console.log("Client connected: ", socket.id);

    socket.on("login", (l: Location, p: string, s: string, sig: string) => {
        login(socket, l, Player.fromPubString(s, p), sig);
    });
    socket.on("getSignature", (uFrom: any, uTo: any) => {
        getSignature(socket, uFrom, uTo);
    });
    socket.on("decrypt", (l: Location, pubkey: string, sig: string) => {
        decrypt(socket, l, Player.fromPubString("", pubkey), sig);
    });

    socket.on("disconnecting", () => {
        disconnectPlayer(socket);
    });
});

/*
 * Event handler for NewMove event. io is passed in so that we can ping players.
 */
nStates.on(nStates.filters.NewMove(), (hUFrom, hUTo) => {
    onMoveFinalize(io, hUFrom.toString(), hUTo.toString());
});

/*
 * Start server & initialize game.
 */
server.listen(process.env.SERVER_PORT, async () => {
    b = new Board();
    await b.seed(BOARD_SIZE, true, nStates);

    console.log(
        `Server running on http://localhost:${process.env.SERVER_PORT}`
    );
});
