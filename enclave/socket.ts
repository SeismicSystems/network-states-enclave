import Utils from "./utils";

interface ServerToClientEvents {
  decryptResponse: (
    r: number,
    c: number,
    symbol: string,
    resource: number,
    key: string
  ) => void;
}

interface ClientToServerEvents {
  decrypt: (r: number, c: number, symbol: string) => void;
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
