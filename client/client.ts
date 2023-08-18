import { ethers } from "ethers";
import readline from "readline";
import { io, Socket } from "socket.io-client";

import { ServerToClientEvents, ClientToServerEvents } from "../enclave/socket";
import { Tile, Grid, Location, Utils } from "../game";

const CONTRACT_ADDR: string = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const PORT: number = 3000;
const GRID_SIZE: number = 5;
const UPDATE_MLS: number = 1000;
const MOVE_PROMPT: string = "Next move: ";

const PLAYER_SYMBOL: string = process.argv[2];
const PLAYER_START: Location = {
  r: Number(process.argv[3]),
  c: Number(process.argv[4]),
};
const MOVE_KEYS: Record<string, number[]> = {
  w: [-1, 0],
  a: [0, -1],
  s: [1, 0],
  d: [0, 1],
};

// Anvil defaults
const signer = new ethers.Wallet(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545")
);
const nStates = new ethers.Contract(
  CONTRACT_ADDR,
  require("../contracts/out/NStates.sol/NStates.json").abi,
  signer
);
let g: Grid;

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
let cursor = PLAYER_START;

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  `http://localhost:${PORT}`
);

async function updatePlayerView() {
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      socket.emit("decrypt", { r: i, c: j }, PLAYER_SYMBOL);
    }
  }
}

async function move(inp: string) {
  let nr = cursor.r + MOVE_KEYS[inp][0],
    nc = cursor.c + MOVE_KEYS[inp][1];

  let tFrom: Tile = g.getTile(cursor);
  let tTo: Tile = g.getTile({ r: nr, c: nc });
  let uFrom: Tile = new Tile(tFrom.owner, tFrom.loc, 1, Utils.randFQ());
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

  await nStates.move(
    Utils.FQToStr(uFrom.hash(g.utf8Encoder, g.poseidon)),
    Utils.FQToStr(uTo.hash(g.utf8Encoder, g.poseidon)),
    Utils.FQToStr(tFrom.nullifier(g.poseidon)),
    Utils.FQToStr(tTo.nullifier(g.poseidon))
  );

  socket.emit(
    "move",
    tFrom.toJSON(),
    tTo.toJSON(),
    uFrom.toJSON(),
    uTo.toJSON()
  );

  cursor = { r: nr, c: nc };
}

async function gameLoop() {
  rl.question(MOVE_PROMPT, async (ans) => {
    await move(ans);
    await Utils.sleep(UPDATE_MLS * 2);
    gameLoop();
  });
}

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

socket.on("decryptResponse", (t: any) => {
  g.setTile(Tile.fromJSON(t));
});

socket.on("update", async () => {
  process.stdout.write("\n");
  updatePlayerView();
  await Utils.sleep(UPDATE_MLS);
  g.printView();
  process.stdout.write(MOVE_PROMPT);
});
