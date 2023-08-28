import { Signature } from "maci-crypto";

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
}
