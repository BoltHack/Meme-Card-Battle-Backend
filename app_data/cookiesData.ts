import {Request, Response, NextFunction} from "express";

interface BasicData {
    locale: string;
}

interface CustomRequest extends Request {
    basicData?: BasicData;
}

const cookiesData = async (req: CustomRequest, res: Response, next: NextFunction) => {

    req.basicData = {
        locale: req.cookies['locale'] || 'ru',
    };

    next();
}

export default cookiesData;