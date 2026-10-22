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

import cookiesData from "./app_data/cookiesData";

import { BOT_mode } from "./controllers/bots_controller/BOT_easyMode";
import { start } from "./config/db";
import { GAME } from "./controllers/game_controller/game";

import { initLogger } from "./config/ConfigLogger";

import UsersModel from "./models/UsersModel";
import GamesModel from "./models/GamesModel";
import mongoose from "mongoose";

const serverPort = process.env.BACKEND_PORT;
const FrontendIP = process.env.FRONTEND_IP;

const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: FrontendIP,
    // origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
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
    console.log("i", i);

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

// app.use((req, res, next) => {
//   if (!req.headers.origin || req.headers.origin !== FrontendIP) {
//     return res.status(403).json({ error: "Прямой доступ запрещен" });
//   }
//   next();
// });

app.use(
  cors({
    // origin: function (origin, callback) {
    //   callback(null, true);
    // },
    origin: FrontendIP,
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
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
