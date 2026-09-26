import { NextFunction, Request, Response } from "express";

import authenticateJWT from "./authenticateJWT";

interface UserData {
  id: string;
  name: string;
  role: string;
}
interface BasicData {
  locale: string;
}
interface CustomRequest extends Request {
  user?: UserData;
  basicData?: BasicData;
}

export const PageRender = (
  render_type: "auth" | "no_auth" | "public" | string,
) => {
  return async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
      const locale = req.basicData?.locale;
      const hasRefreshToken = !!req.cookies?.["refresh_token"];

      if (hasRefreshToken) {
        return authenticateJWT(req as any, res, async (err?: any) => {
          if (res.headersSent) return;
          if (err) return next(err);

          const user = req.user as UserData;

          if (render_type === "auth" || render_type === "no_auth") {
            return res.status(200).json({
              id: user?.id || "",
              role: user?.role || "",
              locale: locale,
            });
          }

          return next();
        });
      }
      if (render_type === "no_auth" && !hasRefreshToken) {
        return res.status(200).json({
          id: "",
          locale: locale,
        });
      }
      if (render_type === "auth" && !hasRefreshToken) {
        return res.status(401).json({ error: "auth error" });
      }

      return next();
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };
};

export const PageRender_v2 = (
  render_type: "auth" | "no_auth",
  render_data: any,
) => {
  return async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
      const locale = req.basicData?.locale;
      const hasRefreshToken = !!req.cookies?.["refresh_token"];

      if (hasRefreshToken) {
        return authenticateJWT(req as any, res, async (err?: any) => {
          if (res.headersSent) return;
          if (err) return next(err);

          const user = req.user as UserData;

          if (render_type === "auth" || render_type === "no_auth") {
            return res.status(200).json({
              id: user?.id || "",
              role: user?.role || "",
              locale: locale,
              renderData: render_data,
            });
          }

          return next();
        });
      }
      if (render_type === "no_auth" && !hasRefreshToken) {
        return res.status(200).json({
          locale: locale,
          renderData: render_data,
        });
      }
      if (render_type === "auth" && !hasRefreshToken) {
        return res.status(401).json({ error: "auth error" });
      }

      return next();
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };
};

// export default PageRender;
