import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";

import UsersModel from "../../models/UsersModel";
import CardsModel from "../../models/CardsModel";
import App_CasesConfigModel from "../../models/admin/App_CasesConfigModel";

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

function getRandomCard(pool: any) {
  const totalChance = pool.reduce((sum, item) => sum + item.chance, 0);
  let randomNum = Math.random() * totalChance;

  for (let i = 0; i < pool.length; i++) {
    if (randomNum < pool[i].chance) {
      return pool[i];
    }
    randomNum -= pool[i].chance;
  }

  return pool[0];
}

async function createAvatar(req: any, userId: string, avatar: any) {
  if (!req.files || !req.files.avatar) {
    throw new Error("Не удалось загрузить изменения.");
  }

  const imageFile = req.files.avatar;

  if (!imageFile.mimetype.startsWith("image/")) {
    throw new Error("Разрешены только файлы изображений.");
  }

  const fileExt = path.extname(imageFile.name);
  const safeFileName = `${userId}${fileExt}`;

  const imagePath = `uploads/UserCovers/${safeFileName}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads", "UserCovers");
  const savePath = path.join(uploadDir, safeFileName);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // imageFile.mv(savePath, (err: any) => {
  //   if (err) {
  //     console.error("Ошибка при сохранении файла:", err);
  //     return res.status(500).json({ error: "Ошибка при сохранении файла" });
  //   }
  // });

  await new Promise<void>((resolve, reject) => {
    imageFile.mv(savePath, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return imagePath;
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
        renderData: renderData.length > 0 ? renderData : null,
      });
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static GetCaseContentPost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { case_id } = req.params;

      const errorMsg = "Страница не найдена.";

      if (!mongoose.Types.ObjectId.isValid(case_id)) {
        return res.status(404).json({ error: errorMsg });
      }

      const case_info = await App_CasesConfigModel.findById("cases_config_app");

      const caseIndex = case_info.cases.findIndex(
        (c) => c._id.toString() === case_id.toString(),
      );

      const case_data = case_info.cases[caseIndex];

      const cardIds = case_data.content.map((c) => c._id.toString());

      const case_cards = await CardsModel.find({ _id: { $in: cardIds } });

      const formattedCardsArray = case_cards.flatMap((card) => {
        const isRandom = case_data.content.find(
          (c) => c._id.toString() === card._id.toString(),
        );
        const chance = isRandom.chance;

        return {
          id: card.id,
          name: card.card_name,
          description: card.card_description || "",
          avatar: card.card_avatar,
          lvl: card.card_lvl_info?.lvl_number || 1,
          rarity: card.card_lvl_info?.lvl_name || "Default",
          damage: card.card_stats?.card_damage || 0,
          protection: card.card_stats?.card_protection || 0,
          power_slot: card.power_slot || 5,
          chance: chance,
        };
      });

      const renderData = formattedCardsArray;

      return res
        .status(200)
        .json({ success: "Данные успешно получены!", content: renderData });
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static BuyCasePost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { case_id } = req.params;

      const user = req.user as any;

      const case_info = await App_CasesConfigModel.getSettings();

      if (!case_info || !case_info.cases) {
        return res
          .status(500)
          .json({ error: "Конфигурация кейсов не найдена" });
      }

      const case_data = case_info.cases.find(
        (cs) => cs._id.toString() === case_id.toString(),
      );

      if (!case_data) {
        return res.status(404).json({ error: "Кейс не найден" });
      }

      const case_price = Number(case_data.price);
      const case_quantity = Number(case_data.quantity);

      const user_info = await UsersModel.findOneAndUpdate(
        {
          _id: user.id,
          coins: { $gte: case_price },
        },
        {
          $inc: { coins: -case_price },
        },
        {
          new: true,
        },
      );

      if (!user_info) {
        return res.status(400).json({ error: "У вас недостаточно средств." });
      }

      const hasKey = user_info.keys.some(
        (k: any) => k._id.toString() === case_id.toString(),
      );

      if (hasKey) {
        await UsersModel.updateOne(
          { _id: user.id, "keys._id": case_id },
          {
            $inc: { "keys.$.count": case_quantity },
          },
        );
      } else {
        await UsersModel.updateOne(
          { _id: user.id },
          {
            $push: {
              keys: {
                _id: case_id,
                count: case_quantity,
              },
            },
          },
        );
      }

      return res.status(200).json({
        success: "Кейс успешно куплен!",
        coins: user_info.coins,
        shopData: {
          product: case_data.name,
          quantity: case_quantity,
        },
      });
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static OpenCasePost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { case_id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(case_id)) {
        return res.status(404).json({ error: "Кейс не найден" });
      }

      const user = req.user as any;
      const user_info = await UsersModel.findById(user.id);

      if (!user_info) {
        return res.status(404).json({ error: "Пользователь не найден." });
      }

      const case_info = await App_CasesConfigModel.getSettings();

      const caseIndex = case_info.cases.findIndex(
        (cs) => cs._id.toString() === case_id.toString(),
      );

      const userKeys = user_info.keys.findIndex(
        (c) => c._id.toString() === case_id.toString(),
      );

      const case_data = case_info.cases[caseIndex];

      const user_keys_count = user_info.keys[userKeys];

      if (!user_keys_count || Number(user_keys_count.count) < 1) {
        return res
          .status(422)
          .json({ error: "У вас нет ключей для открытия." });
      }

      const user_cards = (user_info as any)?.myCards.map((uc) => uc.quantity);
      const user_cards_count = (user_cards as number[])?.reduce(
        (acc, curr) => acc + curr,
        0,
      );

      if (user_cards_count >= 150) {
        return res.status(403).json({ error: "Ваш инвентарь переполнен." });
      }
      // const user_keys = user_info.keys.find(
      //   (ct) => ct._id.toString() === case_data._id.toString(),
      // );

      const case_map = case_data.content.map((c) => {
        return {
          id: c._id.toString(),
          chance: c.chance,
        };
      });

      const result = getRandomCard(case_map);

      const card_info = await CardsModel.findById(result.id);

      if (!card_info || result.id === undefined) {
        return res.status(404).json({ error: "Карта не найдена" });
      }

      const hasCard = user_info.myCards.some(
        (c) => c.card_id.toString() === result.id.toString(),
      );

      if (hasCard) {
        await UsersModel.updateOne(
          { _id: user.id, "myCards.card_id": result.id },
          {
            $inc: { "myCards.$.quantity": 1 },
          },
        );
      } else {
        await UsersModel.updateOne(
          { _id: user.id },
          {
            $push: {
              myCards: {
                card_id: result.id,
                quantity: 1,
              },
            },
          },
        );
      }

      await UsersModel.findOneAndUpdate(
        {
          _id: user.id,
          "keys._id": case_id,
        },
        {
          $inc: { "keys.$.count": -1 },
        },
        {
          new: true,
        },
      );

      const card_data = {
        card_name: card_info.card_name,
        card_avatar: card_info.card_avatar,
        card_description: card_info.card_description,
        card_damage: card_info?.card_stats?.card_damage,
        card_protection: card_info?.card_stats?.card_protection,
        lvl_number: card_info?.card_lvl_info?.lvl_number,
        lvl_name: card_info?.card_lvl_info?.lvl_name,
        power_slot: card_info.power_slot,
      };

      return res.status(200).json({ success: "Выигрыш!", card: card_data });
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static SaveSettingsProfile = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { aboutMe, isDelete } = req.body;
      const avatar = req.files;

      const user = req.user as any;
      const deleteAvatar = Boolean(isDelete);

      const updateData: Record<string, any> = {};

      if (!deleteAvatar && avatar && (avatar as any).avatar) {
        updateData["image"] = await createAvatar(req, user.id, avatar);
      }
      if (deleteAvatar) {
        updateData["image"] = "";
      }

      if (aboutMe !== undefined) {
        updateData["settings.profile.aboutMe"] = aboutMe;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "Нет данных для обновления" });
      }

      await UsersModel.findOneAndUpdate({ _id: user.id }, { $set: updateData });

      return res.status(200).json({ success: "Настройки профиля сохранены!" });
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
