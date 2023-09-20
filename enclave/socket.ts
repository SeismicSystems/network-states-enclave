import { Location, Player } from "../game";

interface ServerToClientEvents {
    decryptResponse: (t: any) => void;
    getSignatureResponse: (sig: string, uFrom: any, uTo: any) => void;
    pingResponse: (b: boolean, uFrom: any, uTo: any) => void;
    updateDisplay: () => void;
}

interface ClientToServerEvents {
    spawn: (symbol: string, l: Location, pubkey: string) => void;
    decrypt: (l: Location, pubkey: string, sig: string) => void;
    getSignature: (uFrom: any, uTo: any) => void;
    ping: (uFrom: any, uTo: any) => void;
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
