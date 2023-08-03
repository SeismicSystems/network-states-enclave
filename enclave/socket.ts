import { Location } from "./types";

interface ServerToClientEvents {
  decryptResponse: (
    t: any
  ) => void;
  update: () => void;
}

interface ClientToServerEvents {
  decrypt: (l: Location, symbol: string) => void;
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
