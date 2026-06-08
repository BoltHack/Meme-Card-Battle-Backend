import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
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
    static CreateCardsView = async (req: CustomRequest, res: Response, next: NextFunction)=> {
        try {
            const user = req.user as UserData;
            res.json({
                id: user.id,
                locale: req.basicData?.locale,
            });
        } catch (err) {
            console.error('Ошибка:', err);
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            return res.status(500).json({ error: errorMessage });
        }
    }

}

export default AdminController_View;