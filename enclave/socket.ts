import Utils from "./utils";
import Tile from "./Tile";
import { Location } from "./types";

interface ServerToClientEvents {
  decryptResponse: (
    t: Tile
  ) => void;
  update: () => void;
}

interface ClientToServerEvents {
  decrypt: (l: Location, symbol: string) => void;
  move: (tFrom: Tile, tTo: Tile, uFrom: Tile, uTo: Tile) => void;
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
