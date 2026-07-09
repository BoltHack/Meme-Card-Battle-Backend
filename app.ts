import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import cors from "cors";
import crypto from "crypto"
import http from "http";
import fileUpload from "express-fileupload";
import {Server, Socket} from "socket.io";

import indexRouter from "./routes/index.ts";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";

import cookiesData from "./app_data/cookiesData";

import { BOT_mode } from "./controllers/bots_controller/BOT_easyMode";
import { start } from "./services/db";
import { GAME } from "./controllers/game_controller/game";
// import fileUpload from "express-fileupload";

import UsersModel from "./models/UsersModel";
import GamesModel from "./models/GamesModel";

const serverPort = process.env.PORT;

const app = express();
const server = http.createServer(app);
export const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
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

interface UserMongooseData {
    isOnline: boolean;
    gameInfo: string;
}

const clients: Record<string, string> = {};


function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function gameFountTimer(socket, player_id) {
    const user_info = await UsersModel.findByIdAndUpdate(
        player_id,
        { $set: { gameInfo: "Search" } },
        { new: true }
    );

    if (!user_info) return;

    const user_cards = user_info.myCards.map(uc => uc.quantity);
    const user_cards_count = user_cards.reduce((acc, curr) => acc + curr, 0);

    if (user_cards_count < 8) {
        socket.emit("game_error_handler", "У вас недостаточно карт, чтобы начать игру.");
        return;
    }

    let isGameFound = false;
    let isSearchCanceled = false;

    for (let i = 0; i <= 800; i++) {
        console.log('i', i);

        const current_user_info = await UsersModel.findById(player_id);
        if (!current_user_info || current_user_info.gameInfo !== "Search") {
            isSearchCanceled = true;
            console.log('Отмена.');
            break;
        }

        const matched_user = await UsersModel.findOneAndUpdate(
            {
                _id: { $ne: player_id },
                isOnline: true,
                gameInfo: "Search"
            },
            { $set: { gameInfo: "InGame" } },
            { new: true }
        );

        if (matched_user) {
            await UsersModel.updateOne(
                { _id: player_id },
                { $set: { gameInfo: "InGame" } }
            );

            const newGame = await GamesModel.create({
                game_key: crypto.randomUUID(),
                game_type: "player_player",
                game_online: { max_online: 2 },
                users_battle_info: [
                    {
                        _id: user_info._id as any,
                        user_name: user_info.name as any,
                        user_lvl: user_info.lvl as any,
                        user_cards: {
                            battle_cards: [],
                            select_card: ""
                        }
                    },
                    {
                        _id: matched_user._id as any,
                        user_name: matched_user.name as any,
                        user_lvl: matched_user.lvl as any,
                        user_cards: {
                            battle_cards: [],
                            select_card: ""
                        }
                    }
                ],
                bot_battle_info: [{
                    bot_mode: "",
                    bot_id: crypto.randomUUID(),
                    bot_name: "",
                    bot_cards: {
                        battle_cards: [],
                        select_card: ""
                    },
                }]
            });

            const matched_socket_id = clients[matched_user.id];

            console.log(`Матч создан между ${player_id} и ${matched_user._id}`);

            const game_key = newGame.game_key;

            if (matched_socket_id) {
                socket.emit("found_game", { game_key: game_key });

                io.to(matched_socket_id).emit("found_game", { game_key: game_key });
            } else {
                console.log(`Критическая ситуация: сокет для игрока ${matched_user.id} не найден!`);
            }

            isGameFound = true;
            break;
        } else {
            console.log('Игрок не найден, продолжаем поиск...');
        }
        await delay(5000);
    }
    if (!isGameFound && !isSearchCanceled) {
        console.log('В результате поиска никого не было найдено.');
        await UsersModel.updateOne(
            { _id: player_id },
            { $set: { gameInfo: "Default" } }
        );
        socket.emit("game_error_handler", "В результате поиска никого не было найдено.");
    }
}

io.on("connection", async (socket) => {
    console.log(`Пользователь ${socket.id} подключился к дефолтному сокету.`);

    socket.on("user_register", async (data) => {
        const { player_id } = data;
        try {
            const user_info = await UsersModel.findById(player_id);

            if (!user_info) return;

            (socket as SocketData).playerId = player_id;
            clients[player_id] = socket.id;

            setTimeout(async () => {
                if (clients[player_id] === socket.id) {
                    console.log(`${player_id} в сети.`);
                    user_info.isOnline = true as UserMongooseData;
                    await user_info.save() as UserMongooseData;
                }
            }, 3000);
        } catch (err) {
            console.log('err', err);
        }
    });

    socket.on("search_game", async (data) => {
        const { type, player_id } = data;
        try {
            console.log('Режим поиска игры:', type);
            const user_info = await UsersModel.findById(player_id);
            const game_type = Boolean(type);

            if (!user_info) return;

            if (game_type) {

                if (user_info.gameInfo === "InGame") {
                    socket.emit("game_error_handler", "Вы уже находитесь в игре.");
                    return;
                }

                await gameFountTimer(socket, player_id);
            } else if (!game_type) {
                const playerRoom = `game:${player_id}`;
                const activeSockets = await io.in(playerRoom).fetchSockets();

                if (activeSockets.length > 0 && activeSockets[0].rooms.has(`game:${player_id}`)) return;

                user_info.gameInfo = "Default";
                await user_info.save();
            } else {
                console.log('error');
            }
        } catch (err) {
            console.log('err', err);
        }
    });

    socket.on("game_start", async (type) => {
        let isBotActive = false;

        if (type === "player_bot") {
            if (isBotActive) return;

            isBotActive = true;
            BOT_mode(socket);
            GAME(socket);
        } else if (type === "player_player") {
            GAME(socket);
        } else {
            console.log("Ошибка ввода.")
        }
    });

    socket.on("disconnect", async () => {
        console.log(`Пользователь ${socket.id} отключился от дефолтного сокета.`);

        const player_id = (socket as SocketData).playerId;

        const user_info = await UsersModel.findById(player_id);

        if (!user_info) return;

        const playerRoom = `game:${player_id}`;
        const activeSockets = await io.in(playerRoom).fetchSockets();

        if (activeSockets.length > 0 && activeSockets[0].rooms.has(`game:${player_id}`)) return;

        setTimeout(async () => {
            if (clients[player_id] === socket.id) {
                console.log(`${player_id} не в сети.`);
                user_info.isOnline = false;
                user_info.gameInfo = "Default";
                await user_info.save();
            }
        }, 3000);
    });
});

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// app.use('/uploads', (req, res, next) => {
//     next();
// }, express.static(path.join(__dirname, 'uploads')));

app.use(fileUpload({
    // limits: { fileSize: 50 * 1024 * 1024 },
    // abortOnLimit: true,
    // createParentPath: true,
    // safeFileNames: true,
    // preserveExtension: true
    createParentPath: true,
    limits: { fileSize: 5 * 1024 * 1024 },
}));
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

app.use(cookiesData);
app.use('/api', indexRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);

async function launchApp() {
    try {
        await start();

        server.listen(serverPort, () => {
            console.log(`Сервер запущен на порту ${serverPort}`);
        });
    } catch (err) {
        console.log('Не удалось запустить сервер', err);
        process.exit(1);
    }
}

launchApp();

export default app;