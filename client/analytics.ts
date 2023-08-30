import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

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

(async () => {
    console.log("== Merkle Root");
    console.log((await nStates.root()).toString());
    console.log("==\n");

    console.log("== Nullifiers");
    const newNullifierEvents: ethers.Event[] = await nStates.queryFilter(
        nStates.filters.NewNullifier()
    );
    const nullifiers = newNullifierEvents.map((e) => {
        return e.args?.nf.toHexString().slice(0, 5);
    });
    console.log(nullifiers);
    console.log("==\n");

    process.exit(0);
})();
