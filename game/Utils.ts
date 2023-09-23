// @ts-ignore
import { groth16 } from "snarkjs";
import {
    Signature,
    NOTHING_UP_MY_SLEEVE,
    IncrementalQuinTree,
    hash2,
} from "maci-crypto";
import { ethers, BigNumber } from "ethers";

export type Groth16Proof = {
    pi_a: [string, string, string];
    pi_b: [[string, string], [string, string], [string, string]];
    pi_c: [string, string, string];
    protocol: string;
    curve: string;
};

export type Groth16ProofCalldata = {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
    input: string[];
};

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
     * Converts an ASCII string into its BigInt representation. Used to sign
     * the client's socket ID.
     */
    static asciiIntoBigNumber(msg: string): BigInt {
        let result = 0n;
        for (let i = 0; i < msg.length; i++) {
            result = (result << 8n) + BigInt(msg.charCodeAt(i));
        }
        return result;
    }

    /*
     * Wrapper for turning string into type compatible with IncrementalQuinTree.
     */ 
    static hIntoBigNumber(hash: string): BigNumber {
        return BigNumber.from(hash);
     }

    /*
     * Wrapper function for instantiating a new Merkle Tree.
     */
    static newTree(treeDepth: number): IncrementalQuinTree {
        return new IncrementalQuinTree(
            treeDepth,
            NOTHING_UP_MY_SLEEVE,
            2,
            hash2
        );
    }

    /*
     * Use all emitted NewLeaf() events from contract to reconstruct on-chain
     * merkle tree.
     * 
     * [TODO] Memoize using local or third party indexer.
     */
    static async reconstructMerkleTree(
        treeDepth: number,
        nStates: ethers.Contract
    ): Promise<IncrementalQuinTree> {
        const newLeafEvents = await nStates.queryFilter(
            nStates.filters.NewLeaf()
        );
        const leaves = newLeafEvents.map((e) => e.args?.h);
        let tree = Utils.newTree(treeDepth);

        leaves.forEach((lh: BigInt) => {
            tree.insert(lh);
        });
        return tree;
    }

    /* 
     * Constructs a proof that a given leaf (tileHash) is in the merkle root.
     * Uses IncrementalQuinTree's genMerklePath(_index)
     */
    static generateMerkleProof(
        tileHash: string,
        mTree: IncrementalQuinTree
    ) {
        const h = Utils.hIntoBigNumber(tileHash);
        const numLeaves = mTree.leavesPerNode ** mTree.depth;

        let leafIndex: number | undefined;
        for (let i = 0; i < numLeaves; i++) {
            if (h.eq(mTree.getNode(i))) {
                leafIndex = i;
            }
        }
        if (leafIndex === undefined) {
            throw Error("Cannot construct Merkle proof for a hash not in root. "
            + "Hash: " + tileHash);
        }
        const mProof = mTree.genMerklePath(leafIndex);

        // Format indices and pathElements.
        return {
            indices: mProof.indices.map((i: number) => i.toString()),
            pathElements: mProof.pathElements.map((e: BigInt[]) => [e[0].toString()])
        };
    }

    /*
     * Formats a proof into what is expected by the solidity verifier.
     * Inspired by https://github.com/vplasencia/zkSudoku/blob/main/contracts/test/utils/utils.js
     */
    static async exportCallDataGroth16(
        prf: Groth16Proof,
        pubSigs: any
    ): Promise<Groth16ProofCalldata> {
        const proofCalldata: string = await groth16.exportSolidityCallData(
            prf,
            pubSigs
        );
        const argv: string[] = proofCalldata
            .replace(/["[\]\s]/g, "")
            .split(",")
            .map((x: string) => BigInt(x).toString());
        return {
            a: argv.slice(0, 2) as [string, string],
            b: [
                argv.slice(2, 4) as [string, string],
                argv.slice(4, 6) as [string, string],
            ],
            c: argv.slice(6, 8) as [string, string],
            input: argv.slice(8),
        };
    }
}
