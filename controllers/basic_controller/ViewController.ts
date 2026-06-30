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
interface UserMongooseData {
    users_battle_info: object;
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

    static TermsOfUseView = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const user = req.user as UserData;
            res.json({
                id: user.id,
                name: user.name,
                locale: req.basicData?.locale
            });
        } catch (err) {
            console.error('Ошибка:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({ error: errorMessage });
        }
    }

    static GameSettingsView = async (req: CustomRequest, res: Response, next: NextFunction) => {
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

    static GameView = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const { game_type, game_key } = req.params;

            const errorMsg = req.basicData?.locale === 'en' ? 'Game not found.' : 'Игра не найдена.';

            const user = req.user as UserData;

            const game = await GamesModel.findOne({ game_key: game_key }).exec();

            if (!game) {
                return res.status(404).json({ error: errorMsg });
            }

            if (game.game_type.toString() !== game_type.toString()) {
                return res.status(404).json({ error: errorMsg });
            }

            const player_info = game.users_battle_info.find(u => u._id.toString() === user.id) as UserMongooseData;
            const enemy_info = game.users_battle_info.find(u => u._id.toString() !== user.id) as UserMongooseData;

            if (
                game_type === "player_player" && !player_info ||
                game_type === "player_player" && !enemy_info ||
                game_type === "player_bot" && !player_info
            ) {
                return res.status(404).json({ error: errorMsg });
            }

            res.json({
                id: user.id,
                game_key: game_key,
                player_info: {
                    name: player_info?.user_name,
                    lvl: player_info?.user_lvl,
                    health: player_info?.user_health,
                    ult: player_info?.user_ult,
                },
                enemy_info: {
                    name: enemy_info?.user_name || "Bot",
                    lvl: enemy_info?.user_lvl || 0,
                    health: enemy_info?.user_health || 100,
                    ult: enemy_info?.user_ult || 0,
                },
                // my_nickname: player_info.user_name,
                // enemy_nickname: game.game_type === "player_player" ? enemy_info.user_name : game.game_type === "player_bot" ? "bot" : null,
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