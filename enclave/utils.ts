const { FQ } = require("./node_modules/babyjubjub/lib/Field.js");
const { PublicKey, PrivateKey } = require("babyjubjub");

export default class Utils {
  static FQ: InstanceType<typeof FQ>;

  static randFQStr(): string {
    return (
      "0x" + new PrivateKey(PrivateKey.getRandObj().field).s.n.toString(16)
    );
  }

  static zeroFQStr(): string {
    return "0x" + new FQ(0).n.toString(16);
  }

  static toFQ(inp: string): typeof FQ {
    return new FQ(inp);
  }
}
