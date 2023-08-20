import { PrivKey, Keypair } from "maci-domainobjs";
import { formatPrivKeyForBabyJub } from "maci-crypto";

export class Player {
  symbol: string;
  bjjKeys?: Keypair;

  constructor(symb: string, ethPriv?: BigInt) {
    this.symbol = symb;
    if (ethPriv) {
      this.bjjKeys = new Keypair(new PrivKey(formatPrivKeyForBabyJub(ethPriv)));
    }
  }
}
