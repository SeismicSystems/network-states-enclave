const { PrivateKey, PublicKey } = require("babyjubjub");
const privateKeyToPublicKey = require("ethereum-private-key-to-public-key");

export class Player {
  symbol: string;
  ethpubkey?: string;
  privkey?: typeof PrivateKey;
  pubkey?: typeof PublicKey;

  constructor(symb: string, eth_privkey?: string) {
    this.symbol = symb;
    if (eth_privkey) {
      console.log("ETH PRIVKEY:", eth_privkey);
      this.ethpubkey = `0x${privateKeyToPublicKey(eth_privkey).toString("hex")}`
      console.log("ETH PUBKEY:", this.ethpubkey);
    }
  }
}
