import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import authenticateJWT from "../../middlewares/authenticateJWT";
import mongoose from "mongoose";
import GamesModel from "../../models/GamesModel";
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
    basicData: BasicData;
}
class ViewController {

    static MainView = async (req: CustomRequest, res: Response, next: NextFunction)=> {
        try {
            const locale = req.basicData?.locale

            if (req.cookies['refresh_token']) {
                await authenticateJWT(req as any, res, async () => {
                    const user = req.user as UserData;

                    return res.status(200).json({ id: user.id, role: user.role, locale });
                });
                return;
            }
            return res.status(200).json({ id: '', locale });
        } catch (err) {
            console.error('Ошибка:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({ error: errorMessage });
        }
    }

    static BotSettingsView = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const user = req.user as UserData;
            res.json({
                id: user.id,
                locale: req.basicData?.locale,
            });
        } catch (err) {
            console.error('Ошибка:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({ error: errorMessage });
        }
    }

    static HowToPlayView = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            res.json({
                id: 1,
                locale: req.basicData?.locale,
            });
        } catch (err) {
            console.error('Ошибка:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({ error: errorMessage });
        }
    }

    static GameView = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const { game_key } = req.params;

            const user = req.user as UserData;

            const game = await GamesModel.findOne({ game_key: game_key }).exec();

            console.log('game info:', game);

            if (!game) {
                const errorMsg = req.basicData?.locale === 'en' ? 'Game not found.' : 'Игра не найдена.';
                return res.status(404).json({ error: errorMsg });
            }

            res.json({
                id: user.id,
                game_key: game_key,
                locale: req.basicData?.locale,
            });
        } catch (err) {
            console.error('Ошибка:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({ error: errorMessage });
        }
    }

}

export default ViewController;