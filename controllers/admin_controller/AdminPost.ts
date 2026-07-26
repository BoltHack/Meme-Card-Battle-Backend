import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import crypto from "crypto";
// import escapeHtml from "escape-html";
import he from "he";

// function cleanTextRegex(dirtyInput) {
//     const decoded = he.decode(dirtyInput);
//
//     return decoded.replace(/<\/?[^>]+(>|$)/g, '');
// }

function cleanTextRegex(dirtyInput) {
    if (typeof dirtyInput !== 'string') return dirtyInput;

    // 1. Декодируем сущности (dfg&lt;/div превращается в dfg</div>)
    const decoded = he.decode(dirtyInput);

    // 2. Удаляем только HTML-теги.
    // Символы \n при этом полностью сохраняются.
    return decoded.replace(/<\/?[^>]+(>|$)/g, '');
}

import UsersModel from "../../models/UsersModel";
import CardsModel from "../../models/CardsModel";
import BlogsModel from "../../models/BlogsModel";

// function cleanEditorContent(content: string): string {
//     let decoded = he.decode(content);
//
//     const options = {
//         whiteList: {
//             p: [], ul: [], li: [], ol: [], b: [], i: [], u: [],
//             strong: [], h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
//             em: [], br: [],
//             a: ["href", "target"],
//             img: ["src", "alt"]
//         }
//     };
//
//     return filterXSS(decoded, options);
// }

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
    static CreateCardPost = async (req: CustomRequest, res: Response, next: NextFunction) => {
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

                imagePath = `uploads/CardCovers/${cardIdString}/${safeFileName}`;

                const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'CardCovers', cardIdString);
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

    static GetRandomCardPost = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const user = req.user;

            const user_info = await UsersModel.findById(user.id);
            if (!user_info) return res.status(404).json({ error: "Игрок не найден" });

            const random_cards = await CardsModel.aggregate([{ $sample: { size: 1 } }]);

            if (!random_cards && !random_cards.length) {
                return res.status(404).json({ error: "Карта не найдена" });
            }

            random_cards.forEach(card => {
                const existingCard = user_info.myCards.find(c => c.card_id.toString() === card._id.toString());

                if (existingCard) {
                    existingCard.quantity += 1;
                } else {
                    user_info.myCards.push({
                        card_id: card._id, quantity: 1
                    });
                }
            });

            await user_info.save();


            return res.status(200).json({ success: "Карта успешно выдана!" });
        } catch (err) {
            console.error('Ошибка в CreateCardPost:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({error: errorMessage});

        }
    }

    static BlogRedactionPost = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const { post_title, post_description, post_category, content } = req.body;
            const user = req.user;

            console.log('post_title', post_title);
            console.log('post_description', post_description);
            console.log('post_category', post_category);
            console.log('content', content);

            const blog_id = new mongoose.Types.ObjectId();
            const blogIdString = blog_id.toString();
            let imagePath = "";

            if (req.files && req.files.post_cover) {
                const imageFile = Array.isArray(req.files.post_cover)
                    ? req.files.post_cover[0]
                    : req.files.post_cover;

                const fileExt = path.extname(imageFile.name);

                if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
                    return res.status(400).json({ error: "Недопустимый формат файла. Разрешены только изображения." });
                }

                if (imageFile.size > MAX_FILE_SIZE) {
                    return res.status(400).json({ error: "Размер файла не должен превышать 5 МБ." });
                }

                const safeFileName = `${blogIdString}-${crypto.randomUUID()}${fileExt}`;

                imagePath = `uploads/BlogCovers/${blogIdString}/${safeFileName}`;

                const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'BlogCovers', blogIdString);
                const savePath = path.join(uploadDir, safeFileName);

                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, {recursive: true});
                }

                await imageFile.mv(savePath);
            }

            const newBlog = await BlogsModel.create({
                author: {
                    id: user.id,
                    name: user.name
                },
                main_content: {
                    title: post_title,
                    description: post_description,
                    cover: imagePath
                },
                category: post_category,
                content: cleanTextRegex(content)
            });

            return res.status(200).json({ success: "Статья успешно добавлена!" });

        } catch (err) {
            console.error('Ошибка в blogRedactionPost:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({error: errorMessage});

        }
    }

}

export default AdminController_Post;