import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import BlogsModel from "../../models/BlogsModel";
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
class AdminController_View {
    static EditBlogView = async (req: CustomRequest, res: Response, next: NextFunction) => {
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

            const blogData = {
                title: blogRead.main_content?.title,
                description: blogRead.main_content?.description,
                cover: blogRead.main_content?.cover,
                category: blogRead.category,
                date: blogRead.date,
                content: blogRead.content
            }

            res.status(200).json({
                blog: blogData
            });
        } catch (err) {
            console.error('Ошибка:', err);
            return res.status(500).json({ error: err.message });
        }
    }
}

export default AdminController_View;