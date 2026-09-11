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
  static GetCardsPost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { cards_category } = req.params;

      const user = req.user as any;
      const user_info = await UsersModel.findById(user.id);

      if (!user_info) {
        return res
          .status(404)
          .json({ error: "Пользователь не найден в базе данных" });
      }

      const user_cards = (user_info as any)?.myCards || [];

      const cardsArray = user_cards.map((card) => card.card_id);
      const quantityArray = user_cards.map((card) => card.quantity);

      const cardQuery: Record<string, any> = {
        _id: { $in: cardsArray },
      };

      if (cards_category !== "all") {
        cardQuery["card_lvl_info.lvl_name"] =
          String(cards_category).toUpperCase();
      }

      const get_cards = await CardsModel.find(cardQuery);

      const renderData = (get_cards as any)?.map((cards) => {
        const cardIdStr = cards._id.toString();

        const matched_quantity = user_cards.find(
          (c) => c.card_id?.toString() === cardIdStr,
        );

        const quantity = matched_quantity ? matched_quantity.quantity : null;

        return {
          card_id: cards._id.toString(),
          card_damage: cards.card_stats.card_damage,
          card_protection: cards.card_stats.card_protection,
          lvl_number: cards.card_lvl_info.lvl_number,
          lvl_name: cards.card_lvl_info.lvl_name,
          card_name: cards.card_name,
          card_description: cards.card_description,
          card_avatar: cards.card_avatar,
          power_slot: cards.power_slot,
          card_quantity: quantity,
        };
      });

      const cards_count = quantityArray?.reduce((acc, card) => acc + card, 0);
    //   const power_count = renderData?.map(card => card.power_slot * card.card_quantity).reduce((acc, card) => acc + card, 0);

      return res.status(200).json({
        cards_count: cards_count || 0,
        renderData: renderData.length > 0 ? renderData : null
      });
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  // static PlayGame = async (req: CustomRequest, res: Response, next: NextFunction)=> {
  //     try {
  //         const { game_type } = req.params;
  //
  //         const user = req.user as UserData;
  //
  //         const user_info = await UsersModel.findById(user.id);
  //
  //         if (!user_info) {
  //             return res.status(404).json({ error: "Ошибка, данные не найдены." });
  //         }
  //
  //         if (user_info.gameInfo === "Search" || user_info.gameInfo === "InGame") {
  //             return res.status(404).json({ error: "Вы уже в игре или у вас включён режим поиска." });
  //             return;
  //         }
  //
  //         const user_cards = user_info.myCards.map(uc => uc.quantity);
  //         const user_cards_count = user_cards.reduce((acc, curr) => acc + curr, 0);
  //
  //         if (user_cards_count < 8) {
  //             return res.status(403).json({ error: "У вас недостаточно карт, чтобы начать игру." });
  //         }
  //
  //         const newGame = await GamesModel.create({
  //             game_key: crypto.randomUUID(),
  //             game_type: game_type || "player_bot",
  //             game_online: { max_online: 2 },
  //             users_battle_info: [
  //                 {
  //                     _id: user_info.id as UserData,
  //                     user_name: user_info.name as UserData,
  //                     user_type: "Player",
  //                     user_isReady: false,
  //                     user_lvl: user_info.lvl as UserData,
  //                     user_cards: {
  //                         battle_cards: [],
  //                         select_card: ""
  //                     },
  //                 },
  //                 {
  //                     _id: new mongoose.Types.ObjectId(),
  //                     user_name: "Easy Bot",
  //                     user_type: "Bot",
  //                     user_isReady: false,
  //                     user_lvl: 0,
  //                     user_cards: {
  //                         battle_cards: [],
  //                         select_card: ""
  //                     }
  //                 }
  //             ],
  //         });
  //
  //         user_info.gameInfo = "InGame";
  //         user_info.save();
  //
  //         return res.status(200).json({
  //             success: "Новая игра успешно создана!",
  //             game_type: game_type,
  //             game_key: newGame.game_key
  //         });
  //     } catch (err) {
  //         console.error('Ошибка:', err);
  //         const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
  //         return res.status(500).json({ error: errorMessage });
  //     }
  // }
}

export default PostController;
