import { BNInput, ec as EC } from 'elliptic';
import BN = require('bn.js');

import {
    Key,
    KeyType,
    signatureToString,
    stringToSignature,
} from './eosjs-numeric';
import { PublicKey } from './PublicKey';

/** Represents/stores a Signature and provides easy conversion for use with `elliptic` lib */
export class Signature {
    constructor(private signature: Key, private ec: EC) {}

    /** Instantiate Signature from an EOSIO-format Signature */
    public static fromString(sig: string): Signature {
        const signature = stringToSignature(sig);
        return new Signature(signature, constructElliptic(signature.type));
    }

    /** Instantiate Signature from an `elliptic`-format Signature */
    public static fromElliptic(ellipticSig: EC.Signature, keyType: KeyType): Signature {
        const r = ellipticSig.r.toArray();
        const s = ellipticSig.s.toArray();
        let eosioRecoveryParam;
        if (keyType === KeyType.k1) {
            eosioRecoveryParam = ellipticSig.recoveryParam + 27;
            if (ellipticSig.recoveryParam <= 3) {
                eosioRecoveryParam += 4;
            }
        } else if (keyType === KeyType.r1 || keyType === KeyType.wa) {
            eosioRecoveryParam = ellipticSig.recoveryParam;
        }
        const sigData = new Uint8Array([eosioRecoveryParam].concat(r, s));
        return new Signature({
            type: keyType,
            data: sigData,
        }, constructElliptic(keyType));
    }

    /** Export Signature as `elliptic`-format Signature
     *  NOTE: This isn't an actual elliptic-format Signature, as ec.Signature is not exported by the library.
     *  That's also why the return type is `any`.  We're *actually* returning an object with the 3 params
     *  not an ec.Signature.
     *  Further NOTE: @types/elliptic shows ec.Signature as exported; it is *not*.  Hence the `any`.
     */
    public toElliptic(): any {
        const lengthOfR = 32;
        const lengthOfS = 32;
        const r = new BN(this.signature.data.slice(1, lengthOfR + 1));
        const s = new BN(this.signature.data.slice(lengthOfR + 1, lengthOfR + lengthOfS + 1));

        let ellipticRecoveryBitField;
        if (this.signature.type === KeyType.k1) {
            ellipticRecoveryBitField = this.signature.data[0] - 27;
            if (ellipticRecoveryBitField > 3) {
                ellipticRecoveryBitField -= 4;
            }
        } else if (this.signature.type === KeyType.r1 || this.signature.type === KeyType.wa) {
            ellipticRecoveryBitField = this.signature.data[0];
        }
        const recoveryParam = ellipticRecoveryBitField & 3;
        return { r, s, recoveryParam };
    }

    /** Export Signature as EOSIO-format Signature */
    public toString(): string {
        return signatureToString(this.signature);
    }

    /** Export Signature in binary format */
    public toBinary(): Uint8Array {
        return this.signature.data;
    }

    /** Get key type from signature */
    public getType(): KeyType {
        return this.signature.type;
    }

    /** Verify a constructed signature with a message and public key */
    public verify(message: BNInput, publicKey: PublicKey, encoding?: string): boolean {
        const ellipticSignature = this.toElliptic();
        const ellipticPublicKey = publicKey.toElliptic();
        return this.ec.verify(message, ellipticSignature, ellipticPublicKey, encoding);
    }
}

/** Construct the elliptic curve object based on key type */
const constructElliptic = (type: KeyType): EC => {
    if (type === KeyType.k1) {
        return new EC('secp256k1') as any;
    }
    return new EC('p256') as any;
};
