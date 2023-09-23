import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { BigNumber, ethers, utils } from "ethers";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
} from "./socket";
import { Tile, Player, Board, Location, Utils } from "../game";
import { hexlify } from "ethers/lib/utils";

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

type ClaimedMoved = {
    socketId: string;
    uFrom: Tile;
    uTo: Tile;
    hUFrom: BigNumber;
    hUTo: BigNumber;
};

/*
 * Enclave's internal belief on game state stored in Board object.
 */
let b: Board;

let idToPubKey = new Map<string, string>();
let pubKeyToId = new Map<string, string>();

/*
 *
 */
let players: Player[] = [];

/*
 * List of claimed moves, pend for contract to emit event.
 */
let claimedMoves: ClaimedMoved[] = [];

/*
 * Propose move to enclave. In order for the move to be solidified, the enclave
 * must respond to a leaf event.
 */
async function getSignature(socket: Socket, uFrom: any, uTo: any) {
    const uFromAsTile = Tile.fromJSON(uFrom);
    const hUFrom = BigNumber.from(uFromAsTile.hash());
    const uToAsTile = Tile.fromJSON(uTo);
    const hUTo = BigNumber.from(uToAsTile.hash());

    claimedMoves.push({
        socketId: socket.id,
        uFrom: uFromAsTile,
        uTo: uToAsTile,
        hUFrom,
        hUTo,
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

        // [TODO]: ping player to get their tiles viewed.
        console.log(b.playerTiles.get(pubkey));
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
 * Attach event handlers to a new connection.
 */
io.on("connection", (socket: Socket) => {
    console.log("Client connected: ", socket.id);

    socket.on("spawn", (l: Location, pubkey: string, sig: string) => {
        spawn(socket, l, Player.fromPubString(pubkey), sig);
    });
    socket.on("getSignature", (uFrom: any, uTo: any) => {
        getSignature(socket, uFrom, uTo);
    });
    socket.on("decrypt", (l: Location, pubkey: string, sig: string) => {
        decrypt(socket, l, Player.fromPubString(pubkey), sig);
    });

    nStates.on(nStates.filters.NewMove(), (hUFrom, hUTo) => {
        for (let i = 0; i < claimedMoves.length; i++) {
            const move = claimedMoves[i];
            console.log("move: ", move);

            if (
                move.hUFrom._hex === hUFrom._hex &&
                move.hUTo._hex === hUTo._hex
            ) {
                // Move is no longer pending
                claimedMoves.splice(i, 1);

                // Update enclave belief
                b.setTile(move.uFrom);
                b.setTile(move.uTo);

                // Alert players who own nearby tiles to update their beliefs
                const moveR = move.uTo.loc.r;
                const moveC = move.uTo.loc.c;
                for (let r = moveR - 1; r < moveR + 1; r++) {
                    for (let c = moveC - 1; c < moveC + 1; c++) {
                        if (b.inBounds(r, c)) {
                            const l: Location = { r, c };
                            const tile = b.t[r][c];
                            console.log("tile: ", tile);
                            if (
                                tile.owner != Tile.UNOWNED &&
                                tile.owner.socketId
                            ) {
                                let socketId = tile.owner.socketId;
                                console.log("updateDisplay");
                                socket.to(socketId).emit("updateDisplay", l);
                            }
                        }
                    }
                }
            }
        }
    });
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
