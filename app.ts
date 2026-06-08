import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import cors from "cors";
import http from "http";
import fileUpload from "express-fileupload";
import { Server } from "socket.io";

import indexRouter from "./routes/index.ts";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";

import cookiesData from "./app_data/cookiesData";

import { BOT_mode } from "./controllers/bots_controller/BOT_easyMode";
import { start } from "./services/db";
import { GAME } from "./controllers/game_controller/game";
import fileUpload from "express-fileupload";

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

io.on("connection", async (socket) => {
    console.log(`Пользователь ${socket.id} подключился.`);

    let isBotActive = false;

    socket.on("bot_activate", () => {
        if (isBotActive) return;

        isBotActive = true;
        BOT_mode(socket);
        GAME(socket);
    });

    socket.on("disconnect", () => {
        console.log(`Пользователь ${socket.id} отключился.`);
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
