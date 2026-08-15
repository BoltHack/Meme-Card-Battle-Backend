import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import crypto from "crypto";
import he from "he";

import UsersModel from "../../models/UsersModel";
import CardsModel from "../../models/CardsModel";
import BlogsModel from "../../models/BlogsModel";

function cleanTextRegex(dirtyInput) {
    if (typeof dirtyInput !== 'string') return dirtyInput;

    const decoded = he.decode(dirtyInput);

    return decoded.replace(/<\/?[^>]+(>|$)/g, '');
}

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
            const user = req.user;

            if (!user || user.role !== "Admin") return;

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

            if (!user || user.role !== "Admin") return;

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

    static BlogRedactionPost = (blog_redaction_type: "create" | "edit") => {
        return async (req: CustomRequest, res: Response, next: NextFunction) => {
            try {
                const { post_title, post_description, post_category, content, post_cover } = req.body;
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

                if (req.files && req.files.post_cover && req.files.post_cover?.size > 819) {
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

                    const safeFileName = `${blogIdString.toString()}-${crypto.randomUUID()}${fileExt}`;

                    imagePath = `uploads/BlogCovers/${blogIdString.toString()}/${safeFileName}`;

                    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'BlogCovers', blogIdString.toString());
                    const savePath = path.join(uploadDir, safeFileName);

                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, {recursive: true});
                    }

                    await imageFile.mv(savePath);
                }

                if (blog_redaction_type === "create") {
                    await BlogsModel.create({
                        _id: blogIdString,
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
                } else if (blog_redaction_type === "edit") {
                    blog_info.main_content.title = post_title
                    blog_info.main_content.description = post_description
                    blog_info.category = post_category

                    console.log('file size', req.files?.post_cover?.size);

                    if (imagePath && req.files?.post_cover?.size > 819) {
                        blog_info.main_content.cover = imagePath;
                    }
                    if (post_cover && post_cover === "true") {
                        blog_info.main_content.cover = "";
                    }
                    if (content) {
                        blog_info.content = cleanTextRegex(content)
                    }

                    await blog_info.save();

                    return res.status(200).json({ success: "Статья успешно изменена!" });
                } else {
                    console.log("Ошибка сохранения данных.");
                }

            } catch (err) {
                console.error('Ошибка в blogRedactionPost:', err);
                const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
                return res.status(500).json({error: errorMessage});

            }
        }
    }

    static RemoveBlogPost = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const { blog_id } = req.params;
            const user = req.user;

            if (!user || user.role !== "Admin") return;

            const blog_updated = await BlogsModel.findById(blog_id);

            if (!blog_updated) return;

            const filePath = path.join(process.cwd(), 'public', 'uploads', 'BlogCovers', blog_updated.id.toString());

            fs.rm(filePath, { recursive: true, force: true }, (err) => {
                if (err) {
                    console.error('Ошибка при удалении папки:', err);
                    return;
                }
                console.log('Папка успешно удалена');
            });

            await blog_updated.deleteOne();

            return res.status(200).json({ success: "Публикация успешно удалена!" });
        } catch (err) {
            console.error('Ошибка в blogRedactionPost:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({error: errorMessage});

        }
    }
}

export default AdminController_Post;