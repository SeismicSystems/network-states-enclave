const { FQ } = require("./node_modules/babyjubjub/lib/Field.js");
const { PublicKey, PrivateKey } = require("babyjubjub");

export default class Utils {
  static FQ: InstanceType<typeof FQ>;

  static randFQ(): typeof PrivateKey {
    return new PrivateKey(PrivateKey.getRandObj().field).s;
  }
}
