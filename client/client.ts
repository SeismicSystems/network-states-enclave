import readline from "readline";
import { ethers } from "ethers";
import { io, Socket } from "socket.io-client";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";
import { Player, Tile, Board, Location, Utils } from "../game";

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
  <string>process.env.DEV_PRIV_KEY,
  new ethers.providers.JsonRpcProvider(process.env.RPC_URL)
);
const nStates = new ethers.Contract(
  <string>process.env.CONTRACT_ADDR,
  require(<string>process.env.CONTRACT_ABI).abi,
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
 * Using Socket.IO to manage communication with enclave.
 */
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  `http://localhost:${process.env.SERVER_PORT}`
);

/*
 * Iterates through entire board, asking enclave to reveal all secrets this
 * player is privy to.
 *
 * [TODO] Only ask for tiles that should be out of the fog.
 *
 */
function updatePlayerView() {
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      const l: Location = { r: i, c: j };
      const sig = PLAYER.genSig(Player.hForDecrypt(l, b.poseidon));
      socket.emit(
        "decrypt",
        l,
        PLAYER.bjjPub.serialize(),
        Utils.serializeSig(sig)
      );
    }
  }
}

/*
 * Computes proper state of tile an army is about to move onto. Goes through
 * game logic of what happens during a battle.
 *
 * [TODO] Move this logic to Board.
 */
function computeOntoTile(tTo: Tile, tFrom: Tile, uFrom: Tile): Tile {
  let uTo: Tile;
  if (tTo.owner === tFrom.owner) {
    uTo = Tile.genOwned(
      tTo.owner,
      tTo.loc,
      tTo.resources + tFrom.resources - 1
    );
  } else {
    uTo = Tile.genOwned(
      tTo.owner,
      tTo.loc,
      tTo.resources - tFrom.resources + 1
    );
    if (uTo.resources < 0) {
      uTo.owner = uFrom.owner;
      uTo.resources *= -1;
    }
  }
  return uTo;
}

/*
 * Constructs new states induced by army at cursor moving in one of the
 * cardinal directions. Alerts enclave of intended move before sending it
 * to chain.
 */
async function move(inp: string) {
  let nr = cursor.r + MOVE_KEYS[inp][0],
    nc = cursor.c + MOVE_KEYS[inp][1];

  let tFrom: Tile = b.getTile(cursor);
  let tTo: Tile = b.getTile({ r: nr, c: nc });
  let uFrom: Tile = Tile.genOwned(tFrom.owner, tFrom.loc, 1);
  let uTo: Tile = computeOntoTile(tTo, tFrom, uFrom);

  socket.emit(
    "move",
    tFrom.toJSON(),
    tTo.toJSON(),
    uFrom.toJSON(),
    uTo.toJSON()
  );

  await nStates.move(
    uFrom.hash(b.utf8Encoder, b.poseidon),
    uTo.hash(b.utf8Encoder, b.poseidon),
    tFrom.nullifier(b.poseidon),
    tTo.nullifier(b.poseidon)
  );

  cursor = { r: nr, c: nc };
}

/*
 * Update local view of game board based on enclave response.
 */
function decryptResponse(t: any) {
  b.setTile(Tile.fromJSON(t));
}

/*
 * Refreshes the user's game board view. Done in response to enclave ping that
 * a relevant move was made.
 */
async function updateDisplay() {
  process.stdout.write("\n");
  updatePlayerView();
  await Utils.sleep(UPDATE_MLS);
  b.printView();
  process.stdout.write(MOVE_PROMPT);
}

/*
 * Repeatedly ask user for next move until exit.
 */
async function gameLoop() {
  rl.question(MOVE_PROMPT, async (ans) => {
    await move(ans);
    await Utils.sleep(UPDATE_MLS * 2);
    gameLoop();
  });
}

/*
 * Set up player session with enclave. Spawning if necessary.
 */
socket.on("connect", async () => {
  console.log("Server connection established");

  await Utils.reconstructMerkleRoot(Number(process.env.TREE_DEPTH), nStates);

  // b = new Board();
  // await b.setup();
  // await b.seed(BOARD_SIZE, false, nStates);
  // updatePlayerView();
  // await Utils.sleep(UPDATE_MLS);
  // b.printView();
  // gameLoop();
});

/*
 * Attach event handlers.
 */
socket.on("decryptResponse", decryptResponse);
socket.on("updateDisplay", updateDisplay);
