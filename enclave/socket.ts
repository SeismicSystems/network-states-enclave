import { Location } from "../game";

interface ServerToClientEvents {
    loginResponse: (locs: string[]) => void;
    handshakeDAResponse: (inRecoveryMode: boolean) => void;
    decryptResponse: (t: any) => void;
    spawnSignatureResponse: (sig: string, unowned: any, spawn: any) => void;
    moveSignatureResponse: (sig: string, b: number) => void;
    errorResponse: (msg: string) => void;
    updateDisplay: (locs: string[]) => void;
    sendRecoveredTile: (index: number) => void;
    saveToDatabase: (enc: any) => void;
}

interface ClientToServerEvents {
    login: (l: Location, symb: string, address: string, sig: string) => void;
    handshakeDA: () => void;
    decrypt: (l: Location) => void;
    getSpawnSignature: (
        symb: string,
        address: string,
        sig: string,
        s: string
    ) => void;
    getMoveSignature: (uFrom: any, uTo: any) => void;
    sendRecoveredTileResponse: (enc: any) => void;
    recoveryFinished: () => void;
    saveToDatabaseResponse: () => void;
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
