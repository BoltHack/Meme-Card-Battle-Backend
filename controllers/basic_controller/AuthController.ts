import { Request, Response, NextFunction } from "express";
import UsersModel from "../../models/UsersModel";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import { initLogger } from "../../config/ConfigLogger";

require("dotenv").config();

const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = process.env;

function parseMaxAge(duration: number) {
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

// interface AccessPayload {
//   id: string;
//   name: string;
//   role: string;
//   tokenVersion: number;
// }

// interface RefreshPayload {
//   id: string;
//   tokenVersion: number;
// }

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

      initLogger("info", `Пользователь ${newUser.name} создал аккаунт`);

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

      initLogger("info", `Пользователь ${user.name} вошел в аккаунт`);

      return res
        .status(200)
        .json({ success: "Успешная авторизация!", referer: "/play" });
      // return res.json({ token: accessToken, refreshToken });
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: err.message });
    }
  };

  static ChangePassword = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { old_password, new_password, confirm_password } = req.body;

      const user = req.user as any;
      const userInfo = await UsersModel.findById(user.id);
      
      if (!userInfo) {
        return res.status(404).json({ error: "Пользователь не найден." });
      }

      if (!old_password || !new_password || !confirm_password) {
        return res
          .status(400)
          .json({ error: "Пожалуйста, заполните все поля ввода." });
      }

      const pass = await bcrypt.compare(old_password, userInfo.password);

      if (!pass) {
        return res.status(401).json({ error: "Неверный старый пароль." });
      }

      if (!new_password || !confirm_password) {
        return res
          .status(401)
          .json({ error: "Пароль и подтверджение пароля обязательны." });
      }

      if (new_password !== confirm_password) {
        return res.status(401).json({ error: "Пароли не совпадают." });
      }

      if (
        new_password.length < 6 ||
        new_password.length > 50 ||
        confirm_password.length < 6 ||
        confirm_password.length > 50
      ) {
        return res.status(401).json({
          error:
            "Пароль должен содержать минимум 6 символов и максимум 50 символов.",
        });
      }

      userInfo.tokenVersion = (userInfo.tokenVersion || 0) + 1;

      const accessToken = jwt.sign(
        {
          id: userInfo._id,
          name: userInfo.name,
          role: userInfo.role,
          tokenVersion: userInfo.tokenVersion,
        },
        ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" },
      );

      const refreshToken = jwt.sign(
        {
          id: userInfo._id,
          tokenVersion: userInfo.tokenVersion,
        },
        REFRESH_TOKEN_SECRET,
        { expiresIn: "10d" },
      );

      const hash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
      console.log("auth hash", hash);
      userInfo.refreshTokenHash = hash;

      res.cookie("access_token", accessToken, {
        httpOnly: true,
        secure: false,
        maxAge: parseMaxAge("15m"),
      });
      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: false,
        maxAge: parseMaxAge("10d"),
      });

      const hashedPassword = await bcrypt.hash(new_password, 10);

      const updatePassword = await UsersModel.findByIdAndUpdate(
        { _id: userInfo._id },
        {
          $set: {
            password: hashedPassword,
            tokenVersion: userInfo.tokenVersion,
          },
        },
        { new: true },
      );

      if (!updatePassword) {
        return res.status(401).json({ error: "Пользователь не найден." });
      }

      return res.status(200).json({ success: "Пароль успешно изменён!" });
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
      const user = req.user;

      res.clearCookie("access_token");
      res.clearCookie("refresh_token");

      initLogger("info", `Пользователь ${user.name} вышел из аккаунта`);
      return res.status(200).json({ success: "Вы вышли из системы" });
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: err.message });
    }
  };

  static logoutAllAccounts = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user as any;
      const userInfo = await UsersModel.findById(user.id);

      if (!userInfo) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      userInfo.tokenVersion = (userInfo.tokenVersion || 0) + 1;

      await UsersModel.findByIdAndUpdate(
        { _id: userInfo._id },
        {
          $set: { tokenVersion: userInfo.tokenVersion },
        },
        { new: true },
      );

      initLogger("info", `Пользователь ${user.name} вышел со всех устройств.`);

      return res
        .status(200)
        .json({ success: "Успешный выход со всех аккаунтов!" });
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: err.message });
    }
  };
}

export default AuthController;
