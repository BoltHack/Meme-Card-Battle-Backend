import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import crypto from "crypto";
import he from "he";

import UsersModel from "../../models/UsersModel";
import CardsModel from "../../models/CardsModel";
import BlogsModel from "../../models/BlogsModel";
import AppModel from "../../models/admin/App_GlobalConfigModel";
import App_CaseConfigModel from "../../models/admin/App_CasesConfigModel";

function cleanTextRegex(dirtyInput: string) {
  if (typeof dirtyInput !== "string") return dirtyInput;

  const decoded = he.decode(dirtyInput);

  return decoded.replace(/<\/?[^>]+(>|$)/g, "");
}

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
  // files?: fileUpload.FileArray | null;
}
class AdminController_Post {
  static CreateCardPost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user;

      if (!user || user.role !== "Admin") return;

      const {
        card_name,
        card_description,
        card_damage,
        card_protection,
        lvl_number,
        lvl_name,
        power_slot,
      } = req.body;

      const card_id = new mongoose.Types.ObjectId();
      const cardIdString = card_id.toString();

      let imagePath = "";

      if (req.files && req.files.card_avatar) {
        const imageFile = Array.isArray(req.files.card_avatar)
          ? req.files.card_avatar[0]
          : req.files.card_avatar;

        const fileExt = path.extname(imageFile.name);

        if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
          return res.status(400).json({
            error: "Недопустимый формат файла. Разрешены только изображения.",
          });
        }

        if (imageFile.size > MAX_FILE_SIZE) {
          return res
            .status(400)
            .json({ error: "Размер файла не должен превышать 5 МБ." });
        }

        const safeFileName = `${cardIdString}-${crypto.randomUUID()}${fileExt}`;

        imagePath = `uploads/CardCovers/${cardIdString}/${safeFileName}`;

        const uploadDir = path.join(
          process.cwd(),
          "public",
          "uploads",
          "CardCovers",
          cardIdString,
        );
        const savePath = path.join(uploadDir, safeFileName);

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        await imageFile.mv(savePath);
      }

      const newCard = await CardsModel.create({
        _id: card_id,
        card_name: card_name,
        card_description: card_description,
        card_avatar: imagePath,
        card_stats: {
          card_damage: Number(card_damage) || 0,
          card_protection: Number(card_protection) || 0,
        },
        card_lvl_info: {
          lvl_number: Number(lvl_number) || 1,
          lvl_name: lvl_name,
        },
        power_slot: power_slot,
      });

      return res.status(200).json({
        success: "Новая карта успешно создана!",
        card: newCard,
      });
    } catch (err) {
      console.error("Ошибка в CreateCardPost:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static RemoveCardPost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { card_id } = req.params;
      const user = req.user;

      if (!user || user.role !== "Admin") return;

      const card_updated = await CardsModel.findById(card_id);

      if (!card_updated) return;

      const filePath = path.join(
        process.cwd(),
        "public",
        "uploads",
        "CardCovers",
        card_updated.id.toString(),
      );

      fs.rm(filePath, { recursive: true, force: true }, (err) => {
        if (err) {
          console.error("Ошибка при удалении папки:", err);
          return;
        }
        console.log("Папка успешно удалена");
      });

      await card_updated.deleteOne();

      return res.status(200).json({ success: "Карта успешно удалена!" });
    } catch (err) {
      console.error("Ошибка в cardRedactionPost:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static GetRandomCardPost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user;

      if (!user || user.role !== "Admin") return;

      const user_info = await UsersModel.findById(user.id);
      if (!user_info) return res.status(404).json({ error: "Игрок не найден" });

      const random_cards = await CardsModel.aggregate([
        { $sample: { size: 1 } },
      ]);

      if (!random_cards && random_cards.length === 0) {
        return res.status(404).json({ error: "Карта не найдена" });
      }

      const card = random_cards[0];

      const updatedUser = await UsersModel.findOneAndUpdate(
        {
          _id: user.id,
          "myCards.card_id": card._id,
        },
        {
          $inc: { "myCards.$.quantity": 1 },
        },
        {
          new: true,
        },
      );

      if (!updatedUser) {
        await UsersModel.updateOne(
          { _id: user.id },
          {
            $push: {
              myCards: { card_id: card._id, quantity: 1 },
            },
          },
        );
      }

      return res.status(200).json({ success: "Карта успешно выдана!" });
    } catch (err) {
      console.error("Ошибка в CreateCardPost:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static BlogRedactionPost = (blog_redaction_type: "create" | "edit") => {
    return async (req: CustomRequest, res: Response, next: NextFunction) => {
      try {
        const {
          post_title,
          post_description,
          post_category,
          content,
          post_cover,
        } = req.body;
        const user = req.user;

        if (!user || user.role !== "Admin") return;

        let blogIdString: string;
        let blog_info: any;

        if (blog_redaction_type === "edit") {
          const { blog_id } = req.params;

          blog_info = await BlogsModel.findById(blog_id);

          if (!blog_info || !blog_id) return;

          blogIdString = blog_id;
        } else if (blog_redaction_type === "create") {
          blogIdString = new mongoose.Types.ObjectId();
        } else {
          console.log("Ошибка записи данных.");
        }

        let imagePath = "";

        if (
          req.files &&
          req.files.post_cover &&
          req.files.post_cover?.size > 819
        ) {
          const imageFile = Array.isArray(req.files.post_cover)
            ? req.files.post_cover[0]
            : req.files.post_cover;

          const fileExt = path.extname(imageFile.name);

          if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
            return res.status(400).json({
              error: "Недопустимый формат файла. Разрешены только изображения.",
            });
          }

          if (imageFile.size > MAX_FILE_SIZE) {
            return res
              .status(400)
              .json({ error: "Размер файла не должен превышать 5 МБ." });
          }

          const safeFileName = `${blogIdString.toString()}-${crypto.randomUUID()}${fileExt}`;

          imagePath = `uploads/BlogCovers/${blogIdString.toString()}/${safeFileName}`;

          const uploadDir = path.join(
            process.cwd(),
            "public",
            "uploads",
            "BlogCovers",
            blogIdString.toString(),
          );
          const savePath = path.join(uploadDir, safeFileName);

          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          await imageFile.mv(savePath);
        }

        if (blog_redaction_type === "create") {
          await BlogsModel.create({
            _id: blogIdString,
            author: {
              id: user.id,
              name: user.name,
            },
            main_content: {
              title: post_title,
              description: post_description,
              cover: imagePath,
            },
            category: post_category,
            content: cleanTextRegex(content),
          });

          return res.status(200).json({ success: "Статья успешно добавлена!" });
        } else if (blog_redaction_type === "edit") {
          blog_info.main_content.title = post_title;
          blog_info.main_content.description = post_description;
          blog_info.category = post_category;

          console.log("file size", req.files?.post_cover?.size);

          if (imagePath && req.files?.post_cover?.size > 819) {
            blog_info.main_content.cover = imagePath;
          }
          if (post_cover && post_cover === "true") {
            blog_info.main_content.cover = "";
          }
          if (content) {
            blog_info.content = cleanTextRegex(content);
          }

          await blog_info.save();

          return res.status(200).json({ success: "Статья успешно изменена!" });
        } else {
          console.log("Ошибка сохранения данных.");
        }
      } catch (err) {
        console.error("Ошибка в blogRedactionPost:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Неизвестная ошибка";
        return res.status(500).json({ error: errorMessage });
      }
    };
  };

  static RemoveBlogPost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { blog_id } = req.params;
      const user = req.user;

      if (!user || user.role !== "Admin") return;

      const blog_updated = await BlogsModel.findById(blog_id);

      if (!blog_updated) return;

      const filePath = path.join(
        process.cwd(),
        "public",
        "uploads",
        "BlogCovers",
        blog_updated.id.toString(),
      );

      fs.rm(filePath, { recursive: true, force: true }, (err) => {
        if (err) {
          console.error("Ошибка при удалении папки:", err);
          return;
        }
        console.log("Папка успешно удалена");
      });

      await blog_updated.deleteOne();

      return res.status(200).json({ success: "Публикация успешно удалена!" });
    } catch (err) {
      console.error("Ошибка в blogRedactionPost:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static AddBlogCoverPost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { gallery_cover } = req.body;

      const user = req.user;
      if (!user || user.role !== "Admin") return;

      let imagePath = "";

      if (
        req.files &&
        req.files.gallery_cover &&
        req.files.gallery_cover?.size > 819
      ) {
        const imageFile = Array.isArray(req.files.gallery_cover)
          ? req.files.gallery_cover[0]
          : req.files.gallery_cover;

        const fileExt = path.extname(imageFile.name);

        if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
          return res.status(400).json({
            error: "Недопустимый формат файла. Разрешены только изображения.",
          });
        }

        if (imageFile.size > MAX_FILE_SIZE) {
          return res
            .status(400)
            .json({ error: "Размер файла не должен превышать 5 МБ." });
        }

        const safeFileName = `gallery-${crypto.randomUUID()}${fileExt}`;

        imagePath = `uploads/BlogGalleryCovers/${safeFileName}`;

        const uploadDir = path.join(
          process.cwd(),
          "public",
          "uploads",
          "BlogGalleryCovers",
        );
        const savePath = path.join(uploadDir, safeFileName);

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        await imageFile.mv(savePath);
      }

      // blog_info.covers.push({ path: imagePath });
      // blog_info.save();

      return res
        .status(200)
        .json({ success: "Изображение сохранено!", cover: imagePath });
    } catch (err) {
      console.error("Ошибка в AddBlogCoverPost:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static CreateCasePost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { name, description, icon, rarity, price } = req.body;

      const user = req.user;
      if (!user || user.role !== "Admin") return;

      await App_CaseConfigModel.findByIdAndUpdate(
        "cases_config_app",
        {
          $push: {
            cases: {
              name: String(name),
              description: String(description),
              icon: String(icon),
              rarity: String(rarity),
              price: Number(price),
              content: [],
            },
          },
        },
        { upsert: true, new: true },
      );

      return res.status(200).json({ success: `Новый кейс успешно создан!` });
    } catch (err) {
      console.error("Ошибка в CreateCasePost:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static DeleteCasePost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { case_id } = req.params;

      const user = req.user;
      if (!user || user.role !== "Admin") return;

      await App_CaseConfigModel.findOneAndUpdate(
        { _id: "cases_config_app" },
        { $pull: { cases: { _id: case_id } } },
        { new: true },
      );

      return res.status(200).json({ success: `Кейс успешно удалён!` });
    } catch (err) {
      console.error("Ошибка в DeleteCasePost:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static EditCaseDataPost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { case_id } = req.params;
      const { name, description, icon, rarity, price } = req.body;

      const user = req.user;
      if (!user || user?.role !== "Admin") return;

      const updatedCase = await App_CaseConfigModel.findOneAndUpdate(
        {
          _id: "cases_config_app",
          "cases._id": case_id,
        },
        {
          $set: {
            "cases.$": {
              name: String(name),
              description: String(description),
              icon: String(icon),
              rarity: String(rarity),
              price: Number(price),
            },
          },
        },
        { new: true },
      );

      if (!updatedCase) {
        console.log("Кейс не найден.");
        return;
      }

      return res
        .status(200)
        .json({ success: "Данные кейса успешно обновлены!" });
    } catch (err) {
      console.error("Ошибка в CreateCasePost:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static EditCaseContentPost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { case_id, action_type } = req.params;
      const { card_id, card_chance } = req.body;

      const user = req.user;
      if (!user || user.role !== "Admin") {
        return res.status(403).json({ error: "Доступ запрещен." });
      }

      if (!mongoose.Types.ObjectId.isValid(card_id)) {
        return res.status(404).json({ error: "Несуществующий ID." });
      }

      if (action_type !== "add" && action_type !== "delete") return;

      let updatedCase;

      if (action_type === "delete") {
        updatedCase = await App_CaseConfigModel.findOneAndUpdate(
          {
            _id: "cases_config_app",
          },
          {
            $pull: {
              "cases.$[caseElem].content": {
                _id: card_id,
              },
            },
          },
          {
            new: true,
            arrayFilters: [{ "caseElem._id": case_id }],
          },
        );

        if (!updatedCase) {
          return res.status(404).json({ error: "Карта или кейс не найдены." });
        }

        return res.status(200).json({ success: "Карта успешно удалена!" });
      }

      if (card_id.length < 1 || card_chance.length < 1) {
        return res
          .status(400)
          .json({ error: "Пожалуйста, заполните все поля ввода." });
      }

      const card_info = await CardsModel.findById(card_id);

      if (!card_info) {
        return res.status(404).json({ error: "Кейс не найден." });
      }

      updatedCase = await App_CaseConfigModel.findOneAndUpdate(
        {
          _id: "cases_config_app",
          cases: {
            $elemMatch: {
              _id: case_id,
              "content._id": { $ne: card_id },
            },
          },
        },
        {
          $push: {
            "cases.$[caseElem].content": {
              _id: card_id,
              chance: card_chance,
            },
          },
        },
        {
          new: true,
          arrayFilters: [{ "caseElem._id": case_id }],
        },
      );

      if (!updatedCase) {
        return res
          .status(404)
          .json({ error: "Карта не найдена или уже присутствует в кейсе." });
      }

      return res.status(200).json({
        card: {
          id: card_info?.id,
          name: card_info?.card_name,
          description: card_info?.card_description || "",
          avatar: card_info?.card_avatar,
          lvl: card_info?.card_lvl_info?.lvl_number || 1,
          rarity: card_info?.card_lvl_info?.lvl_name || "Default",
          damage: card_info?.card_stats?.card_damage || 0,
          protection: card_info?.card_stats?.card_protection || 0,
          power_slot: card_info?.power_slot || 5,
          chance: card_chance,
        },
        success: `Карта ${card_id} добавлена в кейс ${case_id}!`,
      });
    } catch (err) {
      console.error("Ошибка в AddNewCardPost:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static EditSettingsPost = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        return res
          .status(400)
          .json({ error: "Тело запроса не должно быть пустым" });
      }

      const [[key, value]] = Object.entries(req.body);

      console.log(`key: ${key} value: ${value}`);

      const updatedState = await AppModel.findOneAndUpdate(
        { _id: "global_config_app" },
        { $set: { [key]: value } },
        { new: true },
      );

      if (!updatedState) {
        return res.status(404).json({ error: "Конфигурация не найдена" });
      }

      return res.status(200).json({ success: "Настройка успешно изменена!" });
    } catch (err) {
      console.error("Ошибка в EditSettingsPost:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };
}

export default AdminController_Post;
