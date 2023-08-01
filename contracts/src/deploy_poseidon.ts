/*
 * Deploy bytecode for poseidon hash w/ t = 3, 6. The former will be used for 
 * hashing internal nodes in the merkle tree and the latter will be used to 
 * hash the pre-image of leaf nodes. 
 */

// @ts-ignore
import { poseidonContract } from "circomlibjs";
import { ethers } from "ethers";

const signer: ethers.Wallet = new ethers.Wallet(
    // using foundry anvil defaults for dev 
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", 
    new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545")
);

const C3: ethers.ContractFactory = new ethers.ContractFactory(
    poseidonContract.generateABI(2),
    poseidonContract.createCode(2),
    signer
);
const C6: ethers.ContractFactory = new ethers.ContractFactory(
    poseidonContract.generateABI(5),
    poseidonContract.createCode(5),
    signer
);

async function logInfo(deployed: ethers.Contract, lbl: string) {
    console.log(`== Deployed ${lbl}`);
    console.log(`- tx hash: ${deployed.deployTransaction.hash}`);
    console.log(`- deployed to: ${deployed.address}`);
    console.log('==');
}
(async () => {
    const deployedC3 = await C3.deploy();
    const deployedC6 = await C6.deploy();

    logInfo(deployedC3, "C3");
    logInfo(deployedC6, "C6");
})();
