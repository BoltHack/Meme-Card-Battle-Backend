import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

import App_GlobalConfigModel from "../models/admin/App_GlobalConfigModel";

// App_GlobalConfigModel.getSettings()
//   .then((config) => {
//     if (!config.configLogger) return;
//   })
//   .catch((err) => {
//     console.error("Ошибка при получении настроек:", err);
//   });

// const logFormat = winston.format.combine(
//   winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
//   winston.format.printf(({ timestamp, level, message }) => {
//     return `${timestamp} [${level.toUpperCase()}]: ${message}`;
//   }),
// );

// export const ConfigLogger = winston.createLogger({
//   format: logFormat,
//   transports: [
//     new DailyRotateFile({
//       dirname: path.join(process.cwd(), "logs"),
//       filename: "combined-%DATE%.log",
//       datePattern: "YYYY-MM-DD",
//       maxFiles: "14d",
//       maxSize: "20m",
//       level: "info",
//     }),

//     new DailyRotateFile({
//       dirname: path.join(process.cwd(), "logs"),
//       filename: "errors-%DATE%.log",
//       datePattern: "YYYY-MM-DD",
//       maxFiles: "30d",
//       maxSize: "20m",
//       level: "error",
//     }),
//   ],
// });

// if (process.env.NODE_ENV !== "production") {
//   ConfigLogger.add(
//     new winston.transports.Console({
//       format: winston.format.combine(winston.format.colorize(), logFormat),
//     }),
//   );
// }

let ConfigLogger: winston.Logger | null = null;

export const initLogger = async (loggerType: "info" | "error" | "warn", loggerMessage: string): Promise<void> => {
  try {
    const configSettings = await App_GlobalConfigModel.getSettings();

    if (!configSettings?.configLogger) {
      if (ConfigLogger) {
        ConfigLogger.clear();
        ConfigLogger = null;
      }
      return;
    }

    if (!ConfigLogger) {
      const logFormat = winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ timestamp, level: type, message: msg }) => {
          return `${timestamp} [${type.toUpperCase()}]: ${msg}`;
        }),
      );

      ConfigLogger = winston.createLogger({
        level: "info",
        format: logFormat,
        transports: [
          new DailyRotateFile({
            dirname: path.join(process.cwd(), "logs"),
            filename: "combined-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            maxFiles: "14d",
            maxSize: "20m",
            level: "info",
          }),
          new DailyRotateFile({
            dirname: path.join(process.cwd(), "logs"),
            filename: "errors-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            maxFiles: "30d",
            maxSize: "20m",
            level: "error",
          }),
        ],
      });

      if (process.env.NODE_ENV !== "production") {
        ConfigLogger.add(
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              logFormat,
            ),
          }),
        );
      }
    }

    if (
      ConfigLogger &&
      typeof ConfigLogger[loggerType as keyof winston.Logger] === "function"
    ) {
      (ConfigLogger[loggerType as keyof winston.Logger] as Function)(
        loggerMessage,
      );
    } else if (ConfigLogger) {
      ConfigLogger.info(loggerMessage);
    }
  } catch (error) {
    console.log("logger error", error);
  }
};
// initLogger();
