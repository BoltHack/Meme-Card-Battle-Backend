import http from "http";
import app from "./app";

import { start } from "./config/db";

import { initLogger } from "./config/ConfigLogger";
import { initSockets } from "./sockets/Io";

const serverPort = process.env.BACKEND_PORT || 3000;
const server = http.createServer(app);

initSockets(server);

// server.listen(serverPort, () => {
//   console.log(`Сервер запущен на порту ${serverPort}`);
// });

async function launchApp() {
  try {
    await start();

    server.listen(serverPort, () => {
      initLogger("info", `Сервер запущен на порту ${serverPort}`);
    });
  } catch (err) {
    console.log("Не удалось запустить сервер", err);
    initLogger("error", `Не удалось запустить сервер ${err}`);
    process.exit(1);
  }
}

launchApp();