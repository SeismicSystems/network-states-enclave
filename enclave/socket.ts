import { Location } from "../game";

interface ServerToClientEvents {
    decryptResponse: (t: any) => void;
    updateDisplay: () => void;
}

interface ClientToServerEvents {
    decrypt: (l: Location, pubkey: string, sig: string) => void;
    move: (tFrom: any, tTo: any, uFrom: any, uTo: any) => void;
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
