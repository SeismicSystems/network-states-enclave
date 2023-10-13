import { Location, Player } from "../game";

interface ServerToClientEvents {
    loginResponse: (locs: string[]) => void;
    handshakeDAResponse: (inRecoveryMode: boolean) => void;
    decryptResponse: (t: any) => void;
    signatureResponse: (sig: string, b: number) => void;
    errorResponse: (msg: string) => void;
    updateDisplay: (locs: string[]) => void;
    recoverTile: (index: number) => void;
    pushToDA: (
        symbol: string,
        pubkey: string,
        ciphertext: string,
        iv: string,
        tag: string,
        isFinalized: boolean
    ) => void;
}

interface ClientToServerEvents {
    login: (l: Location, p: string, s: string, sig: string) => void;
    handshakeDA: () => void;
    decrypt: (l: Location, pubkey: string, sig: string) => void;
    getSignature: (uFrom: any, uTo: any) => void;
    recoverTileResponse: (
        symbol: string,
        pubkey: string,
        ciphertext: string,
        iv: string,
        tag: string,
        isFinalized: boolean
    ) => void;
    recoveryFinished: () => void;
    pushToDAResponse: () => void;
}

interface InterServerEvents {
    hello: () => void;
}

interface SocketData {
    name: string;
}

export {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
};
