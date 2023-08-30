// @ts-ignore
import { groth16 } from "snarkjs";
import {
    Signature,
    NOTHING_UP_MY_SLEEVE,
    IncrementalQuinTree,
    hash2,
} from "maci-crypto";
import { ethers } from "ethers";

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
