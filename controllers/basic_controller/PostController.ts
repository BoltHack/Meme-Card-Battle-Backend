import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import UsersModel from "../../models/UsersModel";
import CardsModel from "../../models/CardsModel";
import GamesModel from "../../models/GamesModel";
import {Schema} from "mongoose";
interface UserData {
    id: string;
    name: string;
}

interface BasicData {
    locale: string;
}
interface CustomRequest extends Request {
    user?: UserData;
    basicData: BasicData;
}
class PostController {

    static PlayGame = async (req: CustomRequest, res: Response, next: NextFunction)=> {
        try {
            const { game_type } = req.params;

            const user = req.user as UserData;

            const user_info = await UsersModel.findById(user.id);

            // const user_card_entry = user_info.myCards.map(c => c.card_id?.toString());
            // if (user_card_entry.length < 8) {
            //     return res.status(402).json({ error: "Недостаточно карт для игры" });
            // }

            const newGame = await GamesModel.create({
                game_key: crypto.randomUUID(),
                game_type: game_type || "player_bot",
                game_online: {
                    max_online: 2,
                    online: 0
                },
                users_battle_info: [{
                    _id: user_info.id as UserData,
                    user_name: user_info.name as UserData,
                    user_cards: {
                        battle_cards: [],
                        select_card: ""
                    }
                }],
                bot_battle_info: [{
                    bot_mode: "",
                    bot_id: crypto.randomUUID(),
                    bot_name: "",
                    bot_cards: {
                        battle_cards: [],
                        select_card: ""
                    },
                }]
            });

            return res.status(200).json({
                success: "Новая игра успешно создана!",
                game_type: game_type,
                game_id: newGame.game_key
            });
        } catch (err) {
            console.error('Ошибка:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({ error: errorMessage });
        }
    }

}

export default PostController;