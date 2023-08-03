import { ethers } from "ethers";

const CONTRACT_ADDR: string = "0xFD471836031dc5108809D173A067e8486B9047A3";

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

(async () => {
  console.log("== Merkle Root")
  console.log(await nStates.root());
  console.log("==\n");

  console.log("== Nullifiers")
  const newNullifierEvents: ethers.Event[] = await nStates.queryFilter(
      nStates.filters.NewNullifier()
  );
  const nullifiers = newNullifierEvents.map((e) => {
    return e.args?.nf.toHexString().slice(0, 5)
  });
  console.log(nullifiers);
  console.log("==\n");

  process.exit(0);
})();
