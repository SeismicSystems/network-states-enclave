// @ts-ignore
import { poseidon } from "circomlib";
import { PrivKey, PubKey } from "maci-domainobjs";
import {
    Signature,
    formatPrivKeyForBabyJub,
    genPubKey,
    genPrivKey,
    sign,
    verifySignature,
    hash2,
    hashOne,
} from "maci-crypto";
import { Location } from "./Tile.js";

// Public key values that signify an unowned tile.
const UNOWNED_PUB_X = hashOne(BigInt(0));
const UNOWNED_PUB_Y = hashOne(BigInt(0));

export class Player {
    symbol: string;
    bjjPriv?: PrivKey;
    bjjPrivHash?: BigInt;
    bjjPub!: PubKey;
    socketId?: string;

    constructor(
        symb: string,
        ethPriv?: BigInt,
        bjjPub?: PubKey,
        socketId?: string
    ) {
        this.symbol = symb;
        if (ethPriv) {
            this.bjjPriv = new PrivKey(formatPrivKeyForBabyJub(ethPriv));
        } else if (bjjPub) {
            this.bjjPub = bjjPub;
        } else {
            this.bjjPriv = new PrivKey(genPrivKey());
        }

        if (this.bjjPriv) {
            this.bjjPub = new PubKey(genPubKey(this.bjjPriv.rawPrivKey));
            this.bjjPrivHash = formatPrivKeyForBabyJub(this.bjjPriv.rawPrivKey);
        }

        // If player is the UNOWNED player, then give the designated pub-keys
        if (symb === "_") {
            this.bjjPub = new PubKey([UNOWNED_PUB_X, UNOWNED_PUB_Y]);
        }

        if (socketId) {
            this.socketId = socketId;
        }
    }

    static fromPubString(s: string, p: string): Player {
        return new Player(s, undefined, PubKey.unserialize(p));
    }

    /*
     * Convert Location into field element in Babyjubjub's base field using
     * Poseidon hash. Assumes both row & col are less than the field's modulus.
     * This is used for decrypt requests to dispel FoW.
     */
    static hForDecrypt(l: Location): BigInt {
        return hash2([BigInt(l.r), BigInt(l.c)]);
    }

    /*
     * Convert socket ID into field element in Babyjubjub's base field using
     * Poseidon hash. This is used for login requests.
     */
    static hForLogin(id: BigInt): BigInt {
        return hashOne(id);
    }

    /*
     * Returns the hash of the player's public key. Circuit input for player's
     * public key.
     */
    public pubKeyHash(): string {
        return poseidon([
            BigInt(this.bjjPub.rawPubKey[0].toString()),
            BigInt(this.bjjPub.rawPubKey[1].toString()),
        ]).toString();
    }

    /*
     * Signs message (Babyjubjub field element) using EDDSA. Player instance
     * must already have a derived private key.
     */
    public genSig(h: BigInt): Signature {
        if (this.bjjPriv === undefined) {
            throw Error(
                "Must instantiate Player w/ ETH private key to enable sigs."
            );
        }
        return sign(this.bjjPriv.rawPrivKey, h);
    }

    /*
     * Verifies signature. Player instance must be instantiated with Babyjubjub
     * public key.
     */
    public verifySig(h: BigInt, sig: Signature): boolean {
        if (this.bjjPub === undefined) {
            throw Error(
                "Must instantiate Player w/ ETH public key to enable sigs."
            );
        }
        return verifySignature(h, sig, this.bjjPub.rawPubKey);
    }
}
