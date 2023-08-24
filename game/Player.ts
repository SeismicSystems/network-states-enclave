import { PrivKey, PubKey } from "maci-domainobjs";
import {
  Signature,
  formatPrivKeyForBabyJub,
  genPubKey,
  sign,
  verifySignature,
} from "maci-crypto";
import { Location } from "./Tile";

export class Player {
  symbol: string;
  bjjPriv?: PrivKey;
  bjjPub?: PubKey;

  constructor(symb: string, ethPriv?: BigInt, bjjPub_?: PubKey) {
    this.symbol = symb;
    if (ethPriv) {
      this.bjjPriv = new PrivKey(formatPrivKeyForBabyJub(ethPriv));
      this.bjjPub = new PubKey(genPubKey(this.bjjPriv.rawPrivKey));
    } else if (bjjPub_) {
      this.bjjPub = bjjPub_;
    }
  }

  /*
   * Convert Location into field element in Babyjubjub's base field using
   * Poseidon hash. Assumes both row & col are less than the field's modulus. 
   * This is used for decrypt requests to dispel FoW. 
   */
  static hForDecrypt(l: Location, poseidon: any): BigInt {
    return BigInt(poseidon.F.toString(poseidon([l.r, l.c])));
  }

  /*
   * Signs message (Babyjubjub field element) using EDDSA. Player instance must
   * already have a derived private key. 
   */
  public genSig(h: BigInt): Signature {
    if (this.bjjPriv === undefined) {
      throw Error("Must instantiate Player w/ ETH private key to enable sigs.");
    }
    return sign(this.bjjPriv.rawPrivKey, h);
  }

  /*
   * Verifies signature. Player instance must be instantiated with Babyjubjub
   * public key. 
   */
  public verifySig(h: BigInt, sig: Signature): boolean {
    if (this.bjjPub === undefined) {
      throw Error("Must instantiate Player w/ ETH public key to enable sigs.");
    }
    return verifySignature(h, sig, this.bjjPub.rawPubKey);
  }
}
