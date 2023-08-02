import Utils from "./utils";
import { Location } from "./types";

interface ServerToClientEvents {
  decryptResponse: (
    l: Location,
    symbol: string,
    resource: number,
    key: string
  ) => void;
}

interface ClientToServerEvents {
  decrypt: (l: Location, symbol: string) => void;
  // move: (: number, c1: number, r2: number, c2: number, )
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
