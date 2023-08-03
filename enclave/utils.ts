const { FQ } = require("./node_modules/babyjubjub/lib/Field.js");
const { PublicKey, PrivateKey } = require("babyjubjub");

export default class Utils {
  static FQ: InstanceType<typeof FQ>;

  static randFQ(): string {
    return new PrivateKey(PrivateKey.getRandObj().field).s;
  }

  static zeroFQ(): string {
    return new FQ(0);
  }

  static strToFQ(inp: string): typeof FQ {
    return new FQ(inp);
  }

  static FQToStr(inp: typeof FQ): string {
    return "0x" + inp.n.toString(16);
  }

  static numToHexStr(inp: number): string {
    return "0x" + BigInt(inp).toString(16)
  }

  static sleep(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
