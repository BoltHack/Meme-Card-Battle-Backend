import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import UsersModel from "../../models/UsersModel";
import CardsModel from "../../models/CardsModel";
import GamesModel from "../../models/GamesModel";
// import mongoose, {Schema} from "mongoose";
interface UserData {
    id: string;
    name: string;
    lvl: number;
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

            if (!user_info) {
                return res.status(404).json({ error: "Ошибка, данные не найдены." });
            }

            if (user_info.gameInfo === "Search" || user_info.gameInfo === "InGame") {
                return res.status(404).json({ error: "Вы уже в игре или у вас включён режим поиска." });
                return;
            }

            const user_cards = user_info.myCards.map(uc => uc.quantity);
            const user_cards_count = user_cards.reduce((acc, curr) => acc + curr, 0);

            if (user_cards_count < 8) {
                return res.status(403).json({ error: "У вас недостаточно карт, чтобы начать игру." });
            }

            const newGame = await GamesModel.create({
                game_key: crypto.randomUUID(),
                game_type: game_type || "player_bot",
                game_online: { max_online: 2 },
                users_battle_info: [
                    {
                        _id: user_info.id as UserData,
                        user_name: user_info.name as UserData,
                        user_type: "Player",
                        user_isReady: false,
                        user_lvl: user_info.lvl as UserData,
                        user_cards: {
                            battle_cards: [],
                            select_card: ""
                        },
                    },
                    {
                        _id: new mongoose.Types.ObjectId(),
                        user_name: "Easy Bot",
                        user_type: "Bot",
                        user_isReady: false,
                        user_lvl: 0,
                        user_cards: {
                            battle_cards: [],
                            select_card: ""
                        }
                    }
                ],
                // bot_battle_info: [{
                //     bot_mode: "",
                //     bot_id: crypto.randomUUID(),
                //     bot_name: "",
                //     bot_cards: {
                //         battle_cards: [],
                //         select_card: ""
                //     },
                // }]
            });

            user_info.gameInfo = "InGame";
            user_info.save();

            return res.status(200).json({
                success: "Новая игра успешно создана!",
                game_type: game_type,
                game_key: newGame.game_key
            });
        } catch (err) {
            console.error('Ошибка:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({ error: errorMessage });
        }
    }

}

export default PostController;