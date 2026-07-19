import { Request, Response, NextFunction } from "express";
import fs from 'fs';
import path from 'path';

import { PageRender_v2 } from "../../middlewares/PageRender";

import GamesModel from "../../models/GamesModel";
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
                // player_info: {
                //     name: player_info?.user_name,
                //     lvl: player_info?.user_lvl,
                //     health: player_info?.user_health,
                //     ult: player_info?.user_ult,
                // },
                // enemy_info: {
                //     name: enemy_info?.user_name || "Bot",
                //     lvl: enemy_info?.user_lvl || 0,
                //     health: enemy_info?.user_health || 100,
                //     ult: enemy_info?.user_ult || 0,
                // },
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
            const pageQuery = parseInt(req.query.page as string, 10);
            const page = isNaN(pageQuery) || pageQuery < 1 ? 1 : pageQuery;

            const limit = 11;
            const skip = (page - 1) * limit;

            const filteredQuery = {
                $or: [
                    { isVisibility: true },
                    { isVisibility: { $exists: false } },
                ],
                'main_content.title': { $exists: true, $ne: "" },
                'main_content.description': { $exists: true, $ne: "" }
            };

            const [allBlogs, totalNews] = await Promise.all([
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
                totalPages: Math.ceil(totalNews / limit),
            }
            return PageRender_v2("no_auth", renderData)(req, res, next);
        } catch (err) {
            console.error('Ошибка:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    static BlogCategoryView = async (req: CustomRequest, res: Response, next: NextFunction) => {
        try {
            const { blog_category } = req.params;

            const pageQuery = parseInt(req.query.page as string, 10);
            const page = isNaN(pageQuery) || pageQuery < 1 ? 1 : pageQuery;
            // const page = parseInt(req.query.page) || 1;
            const limit = 11;
            const skip = (page - 1) * limit;

            const filteredQuery = {
                category: blog_category,
                $or: [
                    { isVisibility: true },
                    { isVisibility: { $exists: false } },
                ],
                'main_content.title': { $exists: true, $ne: "" },
                'main_content.description': { $exists: true, $ne: "" }
            };

            const [allBlogs, totalNews] = await Promise.all([
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
                totalPages: Math.ceil(totalNews / limit),
            }

            return PageRender_v2("no_auth", renderData)(req, res, next);
        } catch (err) {
            console.error('Ошибка:', err);
            return res.status(500).json({ error: err.message });
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
                author: blogRead.author?.name,
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
            return res.status(500).json({ error: err.message });
        }
    }

}

export default ViewController;