import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import cors from "cors";
import http from "http";
import fileUpload from "express-fileupload";
// import axios from "axios";
// import { Server, Socket } from "socket.io";

import indexRouter from "./routes/index";
import playRouter from "./routes/play";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import downloadRouter from "./routes/download";

import cookiesData from "./app_data/cookiesData";

// import { BOT_mode } from "./controllers/bots_controller/BOT_easyMode";
// import { start } from "./config/db";


// const serverPort = process.env.BACKEND_PORT;
// const FrontendIP = process.env.FRONTEND_IP;

const app = express();
// const server = http.createServer(app);

// import { initSockets } from "./sockets/io";

// initSockets(server);

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

// async function launchApp() {
//   try {
//     await start();

//     server.listen(serverPort, () => {
//       initLogger("info", `Сервер запущен на порту ${serverPort}`);
//     });
//   } catch (err) {
//     console.log("Не удалось запустить сервер", err);
//     initLogger("error", `Не удалось запустить сервер ${err}`);
//     process.exit(1);
//   }
// }

// launchApp();

export default app;