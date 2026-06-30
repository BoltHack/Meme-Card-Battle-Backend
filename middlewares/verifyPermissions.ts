import { Request, Response, NextFunction } from "express";

import jwt from "jsonwebtoken";

interface UserData {
    role: string;
}

interface CustomRequest extends Request {
    user?: UserData;
}

function verifyPermissions(role: string) {
    return async (req: CustomRequest, res: Response, next: NextFunction) => {
        const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET!;

        const accessToken = req.cookies["access_token"];

        let locale = req.cookies['locale'] || 'ru';
        if (!req.cookies['locale']) {
            res.cookie('locale', locale, { httpOnly: true, maxAge: 10 * 365 * 24 * 60 * 60 * 1000 });
        }

        if (!accessToken) {
            return res.status(404).json({ error: 'not found.' });
        }

        let decoded: unknown;

        try {
            decoded = jwt.verify(accessToken, accessTokenSecret) as UserData;
        } catch (err) {
            console.log(err)
            return res.status(404).json({ error: 'not found.' });
        }

        if (!decoded || typeof decoded !== 'object' || !('role' in decoded)) {
            return res.status(404).json({ error: 'not found.' });
        }

        const userData = decoded as UserData;

        if (!userData.role || userData.role !== role) {
            return res.status(404).json({ error: 'not found.' });
        }

        req.user = userData;
        next();
    };
}

export default verifyPermissions;