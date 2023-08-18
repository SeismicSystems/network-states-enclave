const { FQ } = require("./node_modules/babyjubjub/lib/Field.js");
const { PrivateKey } = require("babyjubjub");

export type FQType = typeof FQ;

export class Utils {
  /*
   * Sample random element in FQ. Note FQ here refers to the scalar field of 
   * babyjubjub.
   */
  static randFQ(): FQType {
    return PrivateKey.getRandObj().field;
  }

  /*
   * Return the zero element in FQ.
   */
  static zeroFQ(): FQType {
    return new FQ(0);
  }

  /*
   * Convert a string (can be hex, decimal, or binary) to FQ element.
   */
  static strToFQ(inp: string): FQType {
    return new FQ(inp);
  }

  /*
   * Convert FQ object to decimal string. 
   */
  static FQToStr(inp: FQType): string {
    return inp.n.toString(10);
  }

  /*
   * Call `await` on the return value of this function to block. 
   */
  static sleep(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
