import { Request, Response, NextFunction } from "express";
import fs from 'fs';
import path from 'path';

import { PageRender_v2 } from "../../middlewares/PageRender";

import GamesModel from "../../models/GamesModel";
import CardsModel from "../../models/CardsModel";
import UsersModel from "../../models/UsersModel";
import BlogsModel from "../../models/BlogsModel";
import mongoose from "mongoose";

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
    static ReadPage_docs = (setFilePath: string) => {
        return async (req: CustomRequest, res: Response, next: NextFunction) => {
            try {
                const filePath = path.join(process.cwd(), 'data', 'docs', `${setFilePath}.md`);

                if (!fs.existsSync(filePath)) {
                    return res.status(404).json({ error: 'Страница не найдена' });
                }

                // const content = fs.readFileSync(filePath, 'utf8');
                const content = await fs.promises.readFile(filePath, 'utf8');

                // return res.status(200).json({
                //     content: content,
                // });
                return PageRender_v2("no_auth", content)(req, res, next);
            } catch (err) {
                console.error('Ошибка:', err);
                const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
                return res.status(500).json({ error: errorMessage });
            }
        }
    }

    static ReadPage_json = (setFilePath: string) => {
        return async (req: CustomRequest, res: Response, next: NextFunction) => {
            try {
                const filePath = path.join(process.cwd(), 'data', 'json', `${setFilePath}.json`);

                if (!fs.existsSync(filePath)) {
                    return res.status(404).json({ error: 'Страница не найдена' });
                }

                const fileContent = await fs.promises.readFile(filePath, 'utf8');

                const content = JSON.parse(fileContent);

                // return res.status(200).json({
                //     categories: categoryData || "",
                // });
                return PageRender_v2("no_auth", content)(req, res, next);
            } catch (err) {
                console.error('Ошибка:', err);
                const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
                return res.status(500).json({ error: errorMessage });
            }
        }
    }

    static MyCardsView = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const { cards_category } = req.params;
            const user = req.user;
            const user_info = await UsersModel.findById(user.id);

            if (!user_info) {
                return res.status(404).json({ error: 'Пользователь не найден в базе данных' });
            }

            const user_cards = user_info.myCards || [];

            const cardsArray = user_cards.map(card => card.card_id);
            const quantityArray = user_cards.map(card => card.quantity);

            const cardQuery: Record<string, any> = {
                _id: { $in: cardsArray }
            };

            if (cards_category !== 'all') {
                cardQuery["card_lvl_info.lvl_name"] = String(cards_category).toUpperCase();
            }

            const get_cards = await CardsModel.find(cardQuery);

            const renderData = get_cards.map(cards => {
                const cardIdStr = cards._id.toString();

                const matched_quantity = user_cards.find(c => c.card_id?.toString() === cardIdStr);

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
                    power_slot: cards.power_slot
                }
            });

            const cards_count = quantityArray?.reduce((acc, card) => acc + card, 0)

            return res.status(200).json({
                id: user?.id || "",
                name: user?.name || "",
                role: user?.role || "",
                stats: {
                    lvl: user_info.lvl,
                    money: user_info.money,
                    coins: user_info.coins,
                },
                cards_count: cards_count || 0,
                renderData: renderData.length > 0 ? renderData : null
            })
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

            const user_info = await UsersModel.findById(user.id);
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

            const user_cards = user_info.myCards.map(uc => uc.quantity);
            const user_cards_count = user_cards.reduce((acc, curr) => acc + curr, 0);

            if (user_cards_count < 8) {
                return res.status(403).json({ error: "У вас недостаточно карт, чтобы начать игру." });
            }

            res.json({
                id: user.id,
                name: user.name,
                game_key: game_key,
                locale: req.basicData?.locale,
            });
        } catch (err) {
            console.error('Ошибка:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({ error: errorMessage });
        }
    }

    static BlogView = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const pageQuery = parseInt(req.query.page as string, 7);
            const page = isNaN(pageQuery) || pageQuery < 1 ? 1 : pageQuery;

            const limit = 7;
            const skip = (page - 1) * limit;

            const filteredQuery: Record<string, any> = {
                $or: [
                    { isVisibility: true },
                    { isVisibility: { $exists: false } },
                ],
                'main_content.title': { $exists: true, $ne: "" },
                'main_content.description': { $exists: true, $ne: "" }
            }

            const [allBlogs, totalBlogs] = await Promise.all([
                BlogsModel.find(filteredQuery)
                    .sort({ date: -1 })
                    .skip(skip)
                    .limit(limit),
                BlogsModel.countDocuments(filteredQuery)
            ]);

            const blogsData = allBlogs.map(blog => ({
                author: blog.author?.name,
                title: blog.main_content?.title,
                description: blog.main_content?.description,
                cover: blog.main_content?.cover,
                category: blog.category,
                date: blog.date,
                id: blog._id,
            }));

            const renderData = {
                blog: blogsData,
                currentPage: page,
                totalPages: Math.max(1,  Math.ceil(totalBlogs / limit)),
            }
            return PageRender_v2("no_auth", renderData)(req, res, next);
        } catch (err) {
            console.error('Ошибка:', err);
            return res.status(500).json({ error: "Внутренняя ошибка сервера" });
        }
    }

    static BlogCategoryView = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const { blog_category } = req.params;

            const pageQuery = parseInt(req.query.page as string, 7);
            const page = isNaN(pageQuery) || pageQuery < 1 ? 1 : pageQuery;
            // const page = parseInt(req.query.page) || 1;
            const limit = 7;
            const skip = (page - 1) * limit;

            const filteredQuery: Record<string, any> = {
                category: blog_category,
                $or: [
                    { isVisibility: true },
                    { isVisibility: { $exists: false } },
                ],
                'main_content.title': { $exists: true, $ne: "" },
                'main_content.description': { $exists: true, $ne: "" }
            };

            const [allBlogs, totalBlogs] = await Promise.all([
                BlogsModel.find(filteredQuery)
                    .sort({ date: -1 })
                    .skip(skip)
                    .limit(limit),
                BlogsModel.countDocuments(filteredQuery)
            ]);

            const blogsData = allBlogs.map(blog => ({
                author: blog.author?.name,
                title: blog.main_content?.title,
                description: blog.main_content?.description,
                cover: blog.main_content?.cover,
                category: blog.category,
                date: blog.date,
                id: blog._id,
            }));

            const renderData = {
                blog: blogsData,
                currentPage: page,
                // totalPages: Math.ceil(totalBlogs / limit),
                totalPages: Math.max(1,  Math.ceil(totalBlogs / limit)),
            }

            return PageRender_v2("no_auth", renderData)(req, res, next);
        } catch (err) {
            console.error('Ошибка:', err);
            return res.status(500).json({ error: "Внутренняя ошибка сервера" });
        }
    }

    static BlogReadView = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const { blog_id } = req.params;

            const errorMsg = "Страница не найдена."

            if (!mongoose.Types.ObjectId.isValid(blog_id)) {
                return res.status(404).json({ error: errorMsg });
            }

            const blogRead = await BlogsModel.findById(blog_id);

            if (!blogRead || blogRead.isVisibility === false) {
                return res.status(404).json({ error: errorMsg });
            }

            if (!blogRead.main_content || !blogRead.main_content.description) {
                return res.status(404).json({ error: errorMsg });
            }

            const renderData = {
                author: {
                    id: blogRead.author?.id,
                    name: blogRead.author?.name
                },
                title: blogRead.main_content?.title,
                description: blogRead.main_content?.description,
                cover: blogRead.main_content?.cover,
                category: blogRead.category,
                date: blogRead.date,
                content: blogRead.content
            }

            return PageRender_v2("no_auth", renderData)(req, res, next);
        } catch (err) {
            console.error('Ошибка:', err);
            return res.status(500).json({ error: "Внутренняя ошибка сервера" });
        }
    }

}

export default ViewController;