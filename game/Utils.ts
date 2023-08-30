import {
    Signature,
    NOTHING_UP_MY_SLEEVE,
    IncrementalQuinTree,
    hash2,
} from "maci-crypto";
import { ethers } from "ethers";

export class Utils {
    /*
     * Call `await` on the return value of this function to block.
     */
    static sleep(milliseconds: number) {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    /*
     * Serialize a MACI signature.
     */
    static serializeSig(sig: Signature): string {
        return JSON.stringify({
            R8: sig.R8.map((bigIntValue) => bigIntValue.toString()),
            S: sig.S.toString(),
        });
    }

    /*
     * Unserialize a MACI signature.
     */
    static unserializeSig(serializedSignature: string): Signature | null {
        try {
            const parsed = JSON.parse(serializedSignature);
            return {
                R8: [BigInt(parsed["R8"][0]), BigInt(parsed["R8"][1])],
                S: BigInt(parsed["S"]),
            };
        } catch (error) {
            console.error("Error while unserializing signature:", error);
            return null;
        }
    }

    /*
     * Use all emitted NewLeaf() events from contract to reconstruct on-chain
     * merkle root. Logic here is useful for making merkle proofs later (this
     * is why we don't just directly read the root from contract).
     *
     * [TODO] Memoize using local or third party indexer.
     */
    static async reconstructMerkleRoot(
        treeDepth: number,
        nStates: ethers.Contract
    ): Promise<BigInt> {
        const newLeafEvents = await nStates.queryFilter(
            nStates.filters.NewLeaf()
        );
        const leaves = newLeafEvents.map((e) => e.args?.h);
        let tree = new IncrementalQuinTree(
            treeDepth,
            NOTHING_UP_MY_SLEEVE,
            2,
            hash2
        );
        leaves.forEach((lh: BigInt) => {
            tree.insert(lh);
        });
        return tree.root;
    }
}
