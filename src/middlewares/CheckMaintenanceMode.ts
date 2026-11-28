import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import UsersModel from "../models/UsersModel";
import AppModel from "../models/admin/App_GlobalConfigModel";

interface UserData {
  id: string;
}

interface CustomRequest extends Request {
  user?: UserData;
}

const sendMaintenanceResponse = (res: Response) => {
  res.setHeader("Retry-After", "300");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return res.status(503).json({
    error:
      "Сайт находится на техническом обслуживании. Повторите попытку позже.",
  });
};

const CheckMaintenanceMode = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.url === "/favicon.ico" || req.method === "OPTIONS") return next();

    const App = await AppModel.getSettings();

    if (!App?.maintenanceMode) {
      return next();
    }

    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET!;
    const refreshToken = req.cookies["refresh_token"];

    if (!refreshToken) {
      return sendMaintenanceResponse(res);
    }

    let decodedUser = jwt.verify(refreshToken, refreshTokenSecret) as UserData;

    const user_info = await UsersModel.findById(decodedUser.id);

    if (!user_info) {
      return sendMaintenanceResponse(res);
    }

    // const currentTime = Math.floor(Date.now() / 1000);
    // const timeLeft = decodedUser.exp - currentTime;

    // if (timeLeft < 30) {
    //   console.log("Токен почти истек, пора обновлять!");
    // }

    // console.log("timeLeft", timeLeft);

    // req.user = decodedUser;

    if (!user_info || user_info.role !== "Admin") {
      return sendMaintenanceResponse(res);
    }

    return next();
  } catch (err) {
    if (err?.name === "JsonWebTokenError" && err?.message === "jwt malformed") {
      return sendMaintenanceResponse(res);
    }
    console.error("Ошибка в CheckMaintenanceMode:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Неизвестная ошибка";
    return res.status(500).json({ error: errorMessage });
  }
};

export default CheckMaintenanceMode;
