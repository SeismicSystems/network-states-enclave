import { Groth16Proof, Location } from "../game";

interface ServerToClientEvents {
    loginResponse: (locs: string[]) => void;
    trySpawn: () => void;
    handshakeDAResponse: (inRecoveryMode: boolean) => void;
    decryptResponse: (t: any) => void;
    spawnSignatureResponse: (
        virt: any,
        spawn: any,
        sig: string,
        prf: any,
        pubsigs: any
    ) => void;
    moveSignatureResponse: (
        sig: string,
        b: number,
        prf: any,
        pubsigs: any
    ) => void;
    errorResponse: (msg: string) => void;
    updateDisplay: (locs: string[]) => void;
    sendRecoveredTile: (index: number) => void;
    saveToDatabase: (enc: any) => void;
}

interface ClientToServerEvents {
    login: (address: string, sig: string) => void;
    handshakeDA: () => void;
    decrypt: (l: string) => void;
    getSpawnSignature: (symb: string, blind: string) => void;
    getMoveSignature: (uFrom: any, uTo: any, blind: string) => void;
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
