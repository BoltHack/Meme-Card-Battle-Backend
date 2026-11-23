import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import cors from "cors";
import crypto from "crypto";
import http from "http";
import fileUpload from "express-fileupload";
// import axios from "axios";
import { Server, Socket } from "socket.io";

import indexRouter from "./routes/index";
import playRouter from "./routes/play";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import downloadRouter from "./routes/download";

import cookiesData from "./app_data/cookiesData";

import { BOT_mode } from "./controllers/bots_controller/BOT_easyMode";
import { start } from "./config/db";
import { GAME } from "./controllers/game_controller/game";

import { initLogger } from "./config/ConfigLogger";

import UsersModel from "./models/UsersModel";
import GamesModel from "./models/GamesModel";
import mongoose from "mongoose";

const serverPort = process.env.BACKEND_PORT;
// const FrontendIP = process.env.FRONTEND_IP;

const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    // origin: FrontendIP,
    origin: function (origin, callback) {
      callback(null, true);
    },
    // origin: "*",
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

interface SocketData extends Socket {
  playerId?: string;
}
interface UserData {
  _id: string;
  id: string;
  name: string;
  lvl: number;
}

// interface UserMongooseData {
//   isOnline: boolean;
//   gameInfo: string;
// }

const clients: Record<string, string> = {};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const createPlayerBattleInfo = (userInfo: any) => ({
  _id: userInfo._id as any,
  user_name: userInfo.name as any,
  user_avatar: userInfo.image as any,
  user_type: "Player",
  user_isReady: false,
  user_lvl: userInfo.lvl as any,
  user_cards: {
    battle_cards: [],
    select_card: "",
  },
});
async function createGameMatch(
  userInfo: any,
  friendInfo: any,
  socket: any,
  io: any,
  clients: Record<string, string>,
  playerId: string,
) {
  const newGame = await GamesModel.create({
    game_key: crypto.randomUUID(),
    game_type: "player_player",
    game_online: { max_online: 2 },
    users_battle_info: [
      createPlayerBattleInfo(userInfo),
      createPlayerBattleInfo(friendInfo),
    ],
  });

  const matchedSocketId = clients[friendInfo.id];
  console.log(`Матч создан между ${playerId} и ${friendInfo._id}`);

  const { game_key, game_type } = newGame;
  const gamePayload = { game_type, game_key };

  socket.emit("found_game", gamePayload);
  if (matchedSocketId) {
    io.to(matchedSocketId).emit("found_game", gamePayload);
  }

  return newGame;
}

async function gameFountTimer(socket: any, player_id: string) {
  const user_info = await UsersModel.findByIdAndUpdate(
    player_id,
    { $set: { gameInfo: "Search" } },
    { new: true },
  );

  if (!user_info) return;

  if (user_info.gameInfo === "InGame") {
    socket.emit("game_error_handler", "Вы уже находитесь в игре.");
    return;
  }

  const user_cards = user_info.myCards.map((uc) => uc.quantity);
  const user_cards_count = user_cards.reduce((acc, curr) => acc + curr, 0);

  if (user_cards_count < 8) {
    socket.emit(
      "game_error_handler",
      "У вас недостаточно карт, чтобы начать игру.",
    );
    return;
  }

  let isGameFound = false;
  let isSearchCanceled = false;

  for (let i = 0; i <= 800; i++) {
    console.log("Поиск битвы...", i);

    const current_user_info = await UsersModel.findById(player_id);
    if (!current_user_info || current_user_info.gameInfo !== "Search") {
      isSearchCanceled = true;
      console.log("Отмена поиска.");
      break;
    }

    const matched_user = await UsersModel.findOneAndUpdate(
      {
        _id: { $ne: player_id },
        isOnline: true,
        gameInfo: "Search",
      },
      { $set: { gameInfo: "InGame" } },
      { new: true },
    );

    if (matched_user) {
      await UsersModel.updateOne(
        { _id: player_id },
        { $set: { gameInfo: "InGame" } },
      );

      const newGame = await GamesModel.create({
        game_key: crypto.randomUUID(),
        game_type: "player_player",
        game_online: { max_online: 2 },
        users_battle_info: [
          {
            _id: user_info._id as any,
            user_name: user_info.name as any,
            user_avatar: user_info.image as any,
            user_type: "Player",
            user_isReady: false,
            user_lvl: user_info.lvl as any,
            user_cards: {
              battle_cards: [],
              select_card: "",
            },
          },
          {
            _id: matched_user._id as any,
            user_name: matched_user.name as any,
            user_avatar: matched_user.image as any,
            user_type: "Player",
            user_isReady: false,
            user_lvl: matched_user.lvl as any,
            user_cards: {
              battle_cards: [],
              select_card: "",
            },
          },
        ],
      });

      const matched_socket_id = clients[matched_user.id];

      console.log(`Матч создан между ${player_id} и ${matched_user._id}`);

      const game_key = newGame.game_key;
      const game_type = newGame.game_type;

      if (matched_socket_id) {
        socket.emit("found_game", { game_type: game_type, game_key: game_key });

        io.to(matched_socket_id).emit("found_game", {
          game_type: game_type,
          game_key: game_key,
        });
      } else {
        console.log(`Ошибка: сокет игрока ${matched_user.id} не найден.`);
      }

      isGameFound = true;
      break;
    } else {
      console.log("Игрок не найден, продолжаем поиск...");
    }
    await delay(5000);
  }
  if (!isGameFound && !isSearchCanceled) {
    console.log("В результате поиска никого не было найдено.");
    await UsersModel.updateOne(
      { _id: player_id },
      { $set: { gameInfo: "Default" } },
    );
    socket.emit(
      "game_error_handler",
      "В результате поиска никого не было найдено.",
    );
  }
}

io.on("connection", async (socket) => {
  console.log(`Пользователь ${socket.id} подключился к основному сокету.`);

  socket.on("user_register", async (data) => {
    const { player_id } = data;
    try {
      const user_info = await UsersModel.findById(player_id);
      if (!user_info) return;

      (socket as SocketData).playerId = player_id;
      const connectedSocketId = socket.id;

      if (clients[player_id] !== connectedSocketId) {
        clients[player_id] = socket.id;
      }

      // clients[player_id] = socket.id;

      if (clients[player_id] === socket.id) {
        console.log(`${player_id} в сети.`);

        // user_info.isOnline = true;
        // user_info.gameInfo = "Default";
        await UsersModel.updateOne(
          { _id: player_id },
          { $set: { isOnline: true, gameInfo: "Default" } },
        );
        await user_info.save();
      }
    } catch (err) {
      console.log("err", err);
    }
  });

  socket.on("search_game", async (data) => {
    const { type, player_id } = data;
    try {
      console.log("Режим поиска игры:", type);
      const user_info = await UsersModel.findById(player_id);
      const game_type = Boolean(type);

      if (!user_info) return;

      if (game_type) {
        if (user_info.gameInfo === "InGame") {
          socket.emit("game_error_handler", "Вы уже находитесь в игре.");
          return;
        }

        await gameFountTimer(socket, player_id);
      }
      if (!game_type) {
        if (user_info.gameInfo === "InGame") return;

        const playerRoom = `InGame:${player_id}`;
        const activeSockets = await io.in(playerRoom).fetchSockets();

        if (activeSockets.length > 0 && activeSockets[0].rooms.has(playerRoom))
          return;

        if (user_info.gameInfo === "Default") return;

        console.log("game type default");

        // user_info.gameInfo = "Default";
        // await user_info.save();
        await UsersModel.updateOne(
          { _id: player_id },
          { $set: { gameInfo: "Default" } },
        );
      } else {
        console.log("Ошибка. Противник не найден.");
      }
    } catch (err) {
      console.log("err", err);
    }
  });

  socket.on("start_game_bot", async () => {
    try {
      const player_id = (socket as SocketData).playerId;

      const playerRoom = `InGame:${player_id}`;
      const activeSockets = await io.in(playerRoom).fetchSockets();

      if (activeSockets.length > 0 && activeSockets[0].rooms.has(playerRoom)) {
        socket.emit("error_handler", "Вы уже находитесь в игре.");
        return;
      }

      const user_info = await UsersModel.findById(player_id);

      if (!user_info) {
        socket.emit("error_handler", "Ошибка, данные не найдены.");
        return;
      }

      if (user_info.gameInfo === "Search" || user_info.gameInfo === "InGame") {
        socket.emit(
          "error_handler",
          "Вы уже в игре или у вас включён режим поиска.",
        );
        return;
      }

      const user_cards = user_info.myCards.map((uc) => uc.quantity);
      const user_cards_count = user_cards.reduce((acc, curr) => acc + curr, 0);

      if (user_cards_count < 8) {
        socket.emit(
          "error_handler",
          "У вас недостаточно карт, чтобы начать игру.",
        );
        return;
      }

      const newGame = await GamesModel.create({
        game_key: crypto.randomUUID(),
        game_type: "player_bot",
        game_online: { max_online: 2 },
        users_battle_info: [
          {
            _id: user_info.id as UserData,
            user_name: user_info.name as UserData,
            user_type: "Player",
            user_isReady: false,
            user_lvl: user_info.lvl as UserData,
            user_cards: {
              battle_cards: [],
              select_card: "",
            },
          },
          {
            _id: new mongoose.Types.ObjectId(),
            user_name: "Easy Bot",
            user_type: "Bot",
            user_isReady: false,
            user_lvl: 0,
            user_cards: {
              battle_cards: [],
              select_card: "",
            },
          },
        ],
      });

      // user_info.gameInfo = "InGame";
      // user_info.save();

      await UsersModel.findOneAndUpdate(
        { _id: player_id },
        {
          $set: {
            gameInfo: "InGame",
          },
        },
        { new: true },
      );

      socket.emit("success_handler", {
        game_key: newGame.game_key,
      });
    } catch (err) {
      console.log("err", err);
    }
  });

  socket.on("game_start", async (type) => {
    console.log("game_start", type);
    let isBotActive = false;

    if (type === "player_bot") {
      if (isBotActive) return;

      isBotActive = true;
      BOT_mode(socket);
      GAME(socket);
    } else if (type === "player_player") {
      GAME(socket);
    } else {
      console.log("Ошибка ввода.");
    }
  });

  socket.on("invite_game_server", async (data: any) => {
    const { type, action, friendID } = data;
    try {
      const player_id = (socket as SocketData).playerId;

      if (!player_id) return;

      const [user_info, friend_info] = await Promise.all([
        UsersModel.findById(player_id),
        UsersModel.findById(friendID),
      ]);

      if (!user_info || !friend_info) {
        console.log("Пользователь не найден.");
        return;
      }

      if (!friend_info.isOnline) {
        socket.emit("invite_game_client", {
          type: "alert",
          message: `${friend_info.name} не в сети.`,
        });
      }

      const targetFriendId = friendID.toString();
      const matched_socket_id = clients[targetFriendId];

      if (!matched_socket_id) {
        console.log("Нет активного сокета");
        return;
      }

      io.to(matched_socket_id).emit("invite_game_client", {
        type: type,
        action: action,
        message:
          action === "accept"
            ? "Принял ваш вызов!"
            : action === "reject"
              ? "Отклонил ваш вызов!"
              : action === "waiting" && "бросил вам вызов и пригласил в битву!",
        inviterData: {
          id: user_info.id,
          name: user_info.name,
          lvl: user_info.lvl,
          avatar: user_info.image,
        },
      });

      if (type === "game") {
        await createGameMatch(
          user_info,
          friend_info,
          socket,
          io,
          clients,
          player_id,
        );
      }
    } catch (error) {
      console.log("socket error", error);
    }
  });

  socket.on("disconnect", async () => {
    console.log(`Пользователь ${socket.id} отключился от основного сокета.`);

    const player_id = (socket as SocketData).playerId;
    if (!player_id) return;

    const user_info = await UsersModel.findById(player_id);

    if (!user_info) return;

    const playerRoom = `InGame:${player_id}`;
    const activeSockets = await io.in(playerRoom).fetchSockets();

    if (activeSockets.length > 0 && activeSockets[0].rooms.has(playerRoom))
      return;

    // let timer;

    const disconnectedSocketId = socket.id;

    // if (timer[player_id]) {
    //   clearTimeout(timer[player_id]);
    // }

    setTimeout(async () => {
      console.log("Проверка отключения");
      if (clients[player_id] === disconnectedSocketId) {
        console.log(`${player_id} не в сети.`);

        await UsersModel.findByIdAndUpdate(player_id, {
          isOnline: false,
          gameInfo: "Default",
        });

        if (clients[player_id] === disconnectedSocketId) {
          delete clients[player_id];
        }
      } else {
        console.log(
          `Таймер отклонён, игрок ${player_id} успешно переподключился.`,
        );
      }
    }, 3000);
  });
});

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }
  if (req.path.startsWith("/uploads") || req.path.startsWith("/download")) {
    return next();
  }
  if (
    req.headers["sec-fetch-mode"] === "navigate" ||
    req.headers["api-access"] !== "true"
  ) {
    return res.status(403).send(`
    <!DOCTYPE html>
      <html lang="ru">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>403 Доступ запрещен</title>
          <style>
              :root {
                  --bg-color: #f8fafc;
                  --text-color: #0f172a;
                  --card-bg: #ffffff;
                  --accent-color: #ef4444;
                  --secondary-text: #64748b;
              }

              @media (prefers-color-scheme: dark) {
                  :root {
                      --bg-color: #0f172a;
                      --text-color: #f8fafc;
                      --card-bg: #1e293b;
                      --secondary-text: #94a3b8;
                  }
              }

              * {
                  box-sizing: border-box;
                  margin: 0;
                  padding: 0;
              }

              body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  background-color: var(--bg-color);
                  color: var(--text-color);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  padding: 20px;
                  transition: background-color 0.3s ease;
              }

              .container {
                  text-align: center;
                  background-color: var(--card-bg);
                  padding: 40px 30px;
                  border-radius: 16px;
                  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
                  max-width: 450px;
                  width: 100%;
                  animation: fadeIn 0.5s ease-out;
              }

              .icon {
                  font-size: 64px;
                  margin-bottom: 20px;
                  display: inline-block;
                  animation: pulse 2s infinite;
              }

              h1 {
                  font-size: 24px;
                  font-weight: 700;
                  margin-bottom: 12px;
              }

              p {
                  color: var(--secondary-text);
                  font-size: 15px;
                  line-height: 1.6;
                  margin-bottom: 24px;
              }

              .code {
                  display: inline-block;
                  font-family: monospace;
                  background-color: rgba(239, 68, 68, 0.1);
                  color: var(--accent-color);
                  padding: 4px 8px;
                  border-radius: 6px;
                  font-size: 14px;
                  font-weight: bold;
              }

              @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(10px); }
                  to { opacity: 1; transform: translateY(0); }
              }

              @keyframes pulse {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.05); }
              }
          </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">🔒</div>
          <h1>Доступ ограничен</h1>
          <p>Доступ к этому API запрещён. Запросы разрешены только из клиентского приложения.</p>
          <span class="code">HTTP 403 Forbidden</span>
        </div>
      </body>
    </html>
    `);
  }
  next();
});

app.use(
  cors({
    // origin: FrontendIP,
    origin: function (origin, callback) {
      callback(null, true);
    },
    // origin: "*",
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "api-access",
      "ngrok-skip-browser-warning",
      "skip_zrok_interstitial",
    ],
  }),
);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// app.use('/uploads', (req, res, next) => {
//     next();
// }, express.static(path.join(__dirname, 'uploads')));

app.use(
  fileUpload({
    // limits: { fileSize: 50 * 1024 * 1024 },
    // abortOnLimit: true,
    // createParentPath: true,
    // safeFileNames: true,
    // preserveExtension: true
    createParentPath: true,
    limits: { fileSize: 5 * 1024 * 1024 },
  }),
);
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "public", "uploads")),
);

app.use(cookiesData);

app.use("/api", indexRouter);
app.use("/play", playRouter);
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/download", downloadRouter);

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

export default app;
