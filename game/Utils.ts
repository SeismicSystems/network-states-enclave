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
  static unserializeSig(serializedSignature: string): Signature {
    return JSON.parse(serializedSignature, (key, value) => {
      if (key === "R8" && Array.isArray(value)) {
        return value.map((strValue) => BigInt(strValue));
      } else {
        return BigInt(value);
      }
    });
  }
}
