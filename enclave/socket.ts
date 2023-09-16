import { Location } from "../game";

interface ServerToClientEvents {
    decryptResponse: (t: any) => void;
    proposeResponse: (sig: string, uFrom: any, uTo: any) => void;
    pingResponse: (b: boolean, uFrom: any, uTo: any) => void;
}

interface ClientToServerEvents {
    decrypt: (l: Location, pubkey: string, sig: string) => void;
    propose: (uFrom: any, uTo: any) => void;
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
