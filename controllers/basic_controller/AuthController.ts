import { Request, Response, NextFunction } from "express";
import UsersModel from "../../models/UsersModel";
import bcrypt from "bcrypt";
import crypto from "crypto";
const jwt = require("jsonwebtoken");

require("dotenv").config();

const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = process.env;

function parseMaxAge(duration): number {
  const unit = duration.slice(-1);
  const amount = parseInt(duration.slice(0, -1), 10);

  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      throw new Error("Выбраное время не найдено");
  }
}

interface AccessPayload {
  id: string;
  name: string;
  role: string;
  tokenVersion: number;
}

interface RefreshPayload {
  id: string;
  tokenVersion: number;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  password: string;
  role: string;
  tokenVersion: string;
  refreshTokenHash: string;
}

interface CustomRequest extends Request {
  user?: UserData;
}

class AuthController {
  static registerNewUser = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { name, email, password } = req.body;

      const hashPassword = await bcrypt.hash(password, 8);

      const newUser: UserData = new UsersModel({
        name,
        requestName: name.toLowerCase(),
        email: email.toLowerCase(),
        password: hashPassword,
      });

      const accessToken = jwt.sign(
        {
          id: newUser.id,
          name: newUser.name,
          role: newUser.role,
          tokenVersion: newUser.tokenVersion,
        },
        ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" },
      );

      const refreshToken = jwt.sign(
        {
          id: newUser.id,
          tokenVersion: newUser.tokenVersion,
        },
        REFRESH_TOKEN_SECRET,
        { expiresIn: "10d" },
      );

      const hash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      newUser.refreshTokenHash = hash;
      await newUser.save();

      const isProd = process.env.NODE_ENV === "production";

      res.cookie("access_token", accessToken, {
        httpOnly: true,
        // secure: true,
        secure: isProd,
        sameSite: isProd ? "strict" : "lax",
        maxAge: parseMaxAge("15m"),
      });

      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        // secure: true,
        secure: isProd,
        sameSite: isProd ? "strict" : "lax",
        maxAge: parseMaxAge("10d"),
      });

      return res.status(200).json({
        success: "Успешная регистрация!",
        referer: "/play",
      });
    } catch (err) {
      console.error("Ошибка:", err);
      return res
        .status(500)
        .json({ error: err.message || "Внутренняя ошибка сервера" });
    }
  };

  static SignInView = (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      // res.set('Cache-Control', 'no-store');
      // res.set('Pragma', 'no-cache');
      // res.set('Expires', '0');
      if (req.cookies["refresh_token"]) {
        res.status(403).json({ error: "auth error" });
      } else {
        res.status(200).json({ success: "auth connect" });
      }
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: err.message });
    }
  };

  static loginUser = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { email, password } = req.body;
      // const {ip} = req.params;
      const user = (await UsersModel.findOne({ email })) as UserData;

      if (!user) return;

      let locale = req.cookies["locale"] || "ru";

      if (!req.cookies["locale"]) {
        res.cookie("locale", locale, {
          httpOnly: true,
          maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
        });
      }

      if (!user) {
        return res.status(401).json({ error: "Неверный адрес или пароль." });
      }

      const pass = await bcrypt.compare(password, user.password);

      if (!pass) {
        return res.status(401).json({ error: "Неверный адрес или пароль." });
      }

      const accessToken = jwt.sign(
        {
          id: user.id,
          name: user.name,
          role: user.role,
          tokenVersion: user.tokenVersion,
        },
        ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" },
      );

      const refreshToken = jwt.sign(
        {
          id: user.id,
          tokenVersion: user.tokenVersion,
        },
        REFRESH_TOKEN_SECRET,
        { expiresIn: "10d" },
      );

      const hash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
      console.log("auth hash", hash);
      user.refreshTokenHash = hash;

      // user.ip = ip;
      (await user.save()) as UserData;

      const isProd = process.env.NODE_ENV === "production";

      res.cookie("access_token", accessToken, {
        httpOnly: true,
        // secure: true,
        secure: isProd,
        sameSite: isProd ? "strict" : "lax",
        maxAge: parseMaxAge("15m"),
      });

      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        // secure: true,
        secure: isProd,
        sameSite: isProd ? "strict" : "lax",
        maxAge: parseMaxAge("10d"),
      });

      return res
        .status(200)
        .json({ success: "Успешная авторизация!", referer: "/play" });
      // return res.json({ token: accessToken, refreshToken });
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: err.message });
    }
  };

  static logout = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      res.clearCookie("access_token");
      res.clearCookie("refresh_token");

      console.log("Выход...");
      return res.status(200).json({ success: "Вы вышли из системы" });
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: err.message });
    }
  };
}

export default AuthController;
