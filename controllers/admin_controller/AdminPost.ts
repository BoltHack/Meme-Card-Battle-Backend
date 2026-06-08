import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import CardsModel from "../../models/CardsModel";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
// import fileUpload from "express-fileupload";
import crypto from "crypto";

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
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
    static CreateCardPost = async (req: CustomRequest, res: Response, next: NextFunction)=> {
        try {
            const { card_name, card_description, card_damage, card_protection, lvl_number, lvl_name } = req.body;

            const card_id = new mongoose.Types.ObjectId();
            const cardIdString = card_id.toString();

            let imagePath = "";

            if (req.files && req.files.card_avatar) {
                const imageFile = Array.isArray(req.files.card_avatar)
                    ? req.files.card_avatar[0]
                    : req.files.card_avatar;

                const fileExt = path.extname(imageFile.name);

                if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
                    return res.status(400).json({ error: "Недопустимый формат файла. Разрешены только изображения." });
                }

                if (imageFile.size > MAX_FILE_SIZE) {
                    return res.status(400).json({ error: "Размер файла не должен превышать 5 МБ." });
                }

                const safeFileName = `${cardIdString}-${crypto.randomUUID()}${fileExt}`;

                imagePath = `uploads/CardImages/${cardIdString}/${safeFileName}`;

                const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'CardImages', cardIdString);
                const savePath = path.join(uploadDir, safeFileName);

                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, {recursive: true});
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
                    card_protection: Number(card_protection) || 0
                },
                card_lvl_info: {
                    lvl_number: Number(lvl_number) || 1,
                    lvl_name: lvl_name
                }
            });

            return res.status(200).json({
                success: "Новая карта успешно создана!",
                card: newCard
            });

        } catch (err) {
            console.error('Ошибка в CreateCardPost:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({error: errorMessage});

        }
    }
}

export default AdminController_Post;