// @ts-ignore
import { poseidonContract } from "circomlibjs";
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const signer = new ethers.Wallet(
  <string>process.env.DEV_PRIV_KEY,
  new ethers.providers.JsonRpcProvider(process.env.RPC_URL)
);
const C3: ethers.ContractFactory = new ethers.ContractFactory(
  poseidonContract.generateABI(2),
  poseidonContract.createCode(2),
  signer
);

async function logInfo(deployed: ethers.Contract, lbl: string) {
  console.log(`== Deployed ${lbl}`);
  console.log(`- tx hash: ${deployed.deployTransaction.hash}`);
  console.log(`- deployed to: ${deployed.address}`);
  console.log("==");
}

/*
 * Deploy bytecode for poseidon hash w/ t = 3. Used for hashing internal nodes
 * of Merkle Tree.
 */
(async () => {
  const deployedC3 = await C3.deploy();

  logInfo(deployedC3, "C3");
})();
