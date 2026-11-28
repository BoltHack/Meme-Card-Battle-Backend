import http from "http";
import { Server } from "socket.io";
import { MATCHMAKING } from "./Matchmaking";
// import { GAME } from "./Game";

let io: Server;

export function initSockets(server: http.Server): Server {
  io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true,
      optionsSuccessStatus: 200,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "api-access",
        "ngrok-skip-browser-warning",
        "skip_zrok_interstitial",
      ],
    },
  });

  io.on("connection", (socket) => {
    MATCHMAKING(io, socket);
    // GAME(io, socket);
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO не инициализирован");
  return io;
}
