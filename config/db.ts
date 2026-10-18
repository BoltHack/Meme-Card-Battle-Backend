import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

export async function start() {
  try {
    if (!process.env.MONGODB_URL) {
      throw new Error("Отсутствует MONGODB_URL в файле .env");
    }

    mongoose.connection.on("connected", () => {
      console.log("Mongoose успешно подключился к MongoDB");
    });

    mongoose.connection.on("error", (err) => {
      console.error("Ошибка подключения Mongoose:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("Mongoose отключился от MongoDB");
    });

    await mongoose.connect(process.env.MONGODB_URL, {
      serverSelectionTimeoutMS: 30000,
    });

    console.log("База данных подключена...");
  } catch (e) {
    console.error("Ошибка подключения к базе данных:", e.message);
    console.error("Проверьте MONGODB_URL:", process.env.MONGODB_URL);
  }
}
