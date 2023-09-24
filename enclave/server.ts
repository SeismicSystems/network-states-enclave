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

const PRIVKEYS = JSON.parse(<string>process.env.ETH_PRIVKEYS);
const PLAYER_A: Player = new Player("A", BigInt(PRIVKEYS["A"]));
const PLAYER_B: Player = new Player("B", BigInt(PRIVKEYS["B"]));
const PLAYER_C: Player = new Player("C", BigInt(PRIVKEYS["C"]));

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

let idToPubKey = new Map<string, string>();
let pubKeyToId = new Map<string, string>();

/*
 * Claimed moves. A move is finalized whenever NewMove event is emitted.
 */
let claimedMoves = new Map<string, ClaimedMove>();

/*
 * Propose move to enclave. In order for the move to be solidified, the enclave
 * must respond to a leaf event.
 */
async function getSignature(socket: Socket, uFrom: any, uTo: any) {
    const uFromAsTile = Tile.fromJSON(uFrom);
    const hUFrom = uFromAsTile.hash();
    const uToAsTile = Tile.fromJSON(uTo);
    const hUTo = uToAsTile.hash();

    const moveHash = { hUFrom, hUTo };
    claimedMoves.set(hUFrom.concat(hUTo), {
        uFrom: uFromAsTile,
        uTo: uToAsTile
    });

    const digest = utils.solidityKeccak256(
        ["uint256", "uint256"],
        [hUFrom, hUTo]
    );
    const sig = await signer.signMessage(utils.arrayify(digest));

    socket.emit("getSignatureResponse", sig, uFrom, uTo);
}

/*
 * Dev function for spawning a player on the map.
 */
async function spawn(
    socket: Socket,
    l: Location,
    reqPlayer: Player,
    sigStr: string
) {
    // If player is already spawned in, their socket ID will already be stored
    if (idToPubKey.has(socket.id)) {
        return;
    }

    const h = Player.hForSpawn(Utils.asciiIntoBigNumber(socket.id));
    const sig = Utils.unserializeSig(sigStr);
    if (sig && reqPlayer.verifySig(h, sig)) {
        const pubkey = reqPlayer.bjjPub.serialize();

        // Spawn if player is connected for the first time
        if (!pubKeyToId.has(pubkey)) {
            await b.spawn(l, reqPlayer, START_RESOURCES, nStates);
        }

        // Pair the public key and the socket ID
        idToPubKey.set(socket.id, pubkey);
        pubKeyToId.set(pubkey, socket.id);

        let visibleTiles: Tile[] = [];
        b.playerTiles.get(pubkey)?.forEach((l) => {
            visibleTiles.push(...b.getNeighborhood(l));
        });
        socket.emit("spawnResponse", visibleTiles);
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

function onMoveFinalize(io: Server, hUFrom: string, hUTo: string) {
    const moveHash = hUFrom.concat(hUTo);
    const move = claimedMoves.get(moveHash);
    if (move) {
        // Move is no longer pending
        claimedMoves.delete(moveHash);

        // Update state
        b.setTile(move.uFrom);
        b.setTile(move.uTo);

        // Alert nearby players that a displayUpdate is needed
        const displayUpdateLocations = [
            ...b.getNearbyLocations(move.uFrom.loc),
            ...b.getNearbyLocations(move.uTo.loc),
        ];
        for (let l of displayUpdateLocations) {
            const socketId = pubKeyToId.get(
                b.getTile(l).owner.bjjPub.serialize()
            );
            if (socketId) {
                io.to(socketId).emit("updateDisplay", l);
            }
        }
    } else {
        console.log(
            `Move: (${hUFrom}, ${hUTo}) was finalized without a signature.`
        );
    }
}

/*
 * Attach event handlers to a new connection.
 */
io.on("connection", (socket: Socket) => {
    console.log("Client connected: ", socket.id);

    socket.on("spawn", (l: Location, p: string, s: string, sig: string) => {
        spawn(socket, l, Player.fromPubString(s, p), sig);
    });
    socket.on("getSignature", (uFrom: any, uTo: any) => {
        getSignature(socket, uFrom, uTo);
    });
    socket.on("decrypt", (l: Location, pubkey: string, sig: string) => {
        decrypt(socket, l, Player.fromPubString("", pubkey), sig);
    });
});

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
