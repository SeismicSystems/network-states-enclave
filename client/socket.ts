import { ProverStatus } from "@seismic-sys/ns-fow-game/Utils";

interface ServerToClientEvents {
    challengeResponse: (a: string) => void;
    loginResponse: (locs: string[]) => void;
    trySpawn: () => void;
    handshakeDAResponse: (inRecoveryMode: boolean) => void;
    decryptResponse: (t: any) => void;
    spawnSignatureResponse: (
        virt: any,
        spawn: any,
        sig: string,
        prf: any,
        pubsigs: any,
        proverStatus: ProverStatus
    ) => void;
    moveSignatureResponse: (
        sig: string,
        b: string,
        prf: any,
        pubsigs: any,
        proverStatus: ProverStatus
    ) => void;
    updateDisplay: (locs: string[]) => void;
    sendRecoveredTile: (index: number) => void;
    saveToDatabase: (enc: any) => void;
}

interface ClientToServerEvents {
    challenge: () => void;
    login: (sig: string) => void;
    handshakeDA: () => void;
    decrypt: (l: string) => void;
    getSpawnSignature: (symb: string, l: string) => void;
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
