interface ServerToClientEvents {
  hello: () => void;
}

interface ClientToServerEvents {
  move: () => void;
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
    SocketData
}