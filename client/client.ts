import readline from "readline";
import { ethers } from "ethers";
import { io, Socket } from "socket.io-client";
import dotenv from "dotenv";
import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";
import { Tile, Grid, Location, Utils } from "../game";

/*
 * Conditions depend on which player is currently active.
 */
const PLAYER_SYMBOL: string = process.argv[2];
const PLAYER_START: Location = {
  r: Number(process.argv[3]),
  c: Number(process.argv[4]),
};

/*
 * Misc client parameters.
 */
const GRID_SIZE: number = parseInt(<string>process.env.GRID_SIZE, 10);
const UPDATE_MLS: number = 1000;
const MOVE_PROMPT: string = "Next move: ";
const MOVE_KEYS: Record<string, number[]> = {
  w: [-1, 0],
  a: [0, -1],
  s: [1, 0],
  d: [0, 1],
};

/*
 * Boot up interface with 1) Network States contrac and 2) the CLI.
 */
dotenv.config({ path: "../.env" });
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
 * Client's local belief on game state stored in Grid object.
 */
let g: Grid;

/*
 * Using Socket.IO to manage communication with enclave.
 */
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  `http://localhost:${PORT}`
);

/*
 * Iterates through entire grid, asking enclave to reveal all secrets this
 * player is privy to.
 */
async function updatePlayerView() {
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      socket.emit("decrypt", { r: i, c: j }, PLAYER_SYMBOL);
    }
  }
}

/*
 * Computes proper state of tile an army is about to move onto. Goes through
 * game logic of what happens during a fight. 
 */
function computeOntoTile(tTo: Tile, tFrom: Tile, uFrom: Tile): Tile {
  let uTo: Tile;
  if (tTo.owner === tFrom.owner) {
    uTo = new Tile(
      tTo.owner,
      tTo.loc,
      tTo.resources + tFrom.resources - 1,
      Utils.randFQ()
    );
  } else {
    uTo = new Tile(
      tTo.owner,
      tTo.loc,
      tTo.resources - tFrom.resources + 1,
      Utils.randFQ()
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

  let tFrom: Tile = g.getTile(cursor);
  let tTo: Tile = g.getTile({ r: nr, c: nc });
  let uFrom: Tile = new Tile(tFrom.owner, tFrom.loc, 1, Utils.randFQ());
  let uTo: Tile = computeOntoTile(tTo, tFrom, uFrom);

  socket.emit(
    "move",
    tFrom.toJSON(),
    tTo.toJSON(),
    uFrom.toJSON(),
    uTo.toJSON()
  );

  await nStates.move(
    Utils.FQToStr(uFrom.hash(g.utf8Encoder, g.poseidon)),
    Utils.FQToStr(uTo.hash(g.utf8Encoder, g.poseidon)),
    Utils.FQToStr(tFrom.nullifier(g.poseidon)),
    Utils.FQToStr(tTo.nullifier(g.poseidon))
  );

  cursor = { r: nr, c: nc };
}

/*
 * Update local view of game board based on enclave response.
 */
function decryptResponse(t: any) {
  g.setTile(Tile.fromJSON(t));
}

/*
 * Refreshes the user's game board view. Done in response to enclave ping that
 * a relevant move was made.
 */
async function updateDisplay() {
  process.stdout.write("\n");
  updatePlayerView();
  await Utils.sleep(UPDATE_MLS);
  g.printView();
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
 * Connect to enclave and sync with current viewable state.
 */
socket.on("connect", async () => {
  console.log("Server connection established");

  g = new Grid();
  await g.setup();
  await g.seed(GRID_SIZE, false, nStates);

  updatePlayerView();
  await Utils.sleep(UPDATE_MLS);
  g.printView();

  gameLoop();
});

/*
 * Attach event handlers.
 */
socket.on("decryptResponse", decryptResponse);
socket.on("updateDisplay", updateDisplay);
