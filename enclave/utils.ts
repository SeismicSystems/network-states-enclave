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
    return inp.n.toString(10);
  }

  static sleep(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
