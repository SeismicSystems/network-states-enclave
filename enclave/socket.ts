import { Location, Player } from "../game";

interface ServerToClientEvents {
    loginResponse: (locs: string[]) => void;
    decryptResponse: (t: any) => void;
    signatureResponse: (sig: string, b: number) => void;
    errorResponse: (msg: string) => void;
    updateDisplay: (locs: string[]) => void;
}

interface ClientToServerEvents {
    login: (l: Location, p: string, s: string, sig: string) => void;
    decrypt: (l: Location, pubkey: string, sig: string) => void;
    getSignature: (uFrom: any, uTo: any) => void;
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
