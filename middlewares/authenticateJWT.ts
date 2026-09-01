import { Request, Response, NextFunction } from "express";

import jwt from "jsonwebtoken";
import crypto from "crypto";
import UsersModel from "../models/UsersModel";

interface AccessPayload {
    id: string;
    name: string;
    role: string;
    tokenVersion: number;
}

interface RefreshPayload {
    id: string;
    tokenVersion: number;
}

interface CustomRequest extends Request{
    user?: AccessPayload;
}

const verifyToken = <T>(token: string, secretKey: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secretKey, (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded as T);
        });
    });
}

const clearAuthCookies = (res: Response) => {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
};

const authenticateJWT = async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
        const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET!;
        const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET!;

        let accessToken = req.cookies["access_token"];
        let refreshToken = req.cookies["refresh_token"];

        if (!accessToken && !refreshToken) {
            return res.status(401).json({ error: 'auth error.' });
        }

        const authHeader = req.headers.authorization;
        if (!accessToken && authHeader && authHeader?.startsWith("Bearer ")) {
            accessToken = authHeader.split(" ")[1];
        }

        if (accessToken) {
            try {
                const user = await verifyToken<AccessPayload>(accessToken, accessTokenSecret);

                req.user = user;
                return next();
            } catch {
                console.log('Проблемы с Access токеном.');
            }
        }

        if (!refreshToken) {
            clearAuthCookies(res);
            return res.status(401).json({ error: 'auth error.' });
        }

        let decodedRefresh: RefreshPayload | null = null;
        try {
            if (refreshToken) {
                decodedRefresh  = await verifyToken<RefreshPayload>(refreshToken, refreshTokenSecret);
            }
        } catch (error) {
            clearAuthCookies(res);
            console.log('logout');
            return res.status(401).json({ error: 'auth error.' });
        }

        const userInfo = await UsersModel.findById(decodedRefresh?.id) as any;
        const currentHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        if (!userInfo || userInfo.refreshTokenHash !== currentHash || userInfo.tokenVersion !== decodedRefresh?.tokenVersion) {
            clearAuthCookies(res);
            return res.status(403).json({ message: 'Session compromised' });
        }

        const payload: AccessPayload = {
            id: userInfo._id.toString(),
            name: userInfo.name,
            role: userInfo.role,
            tokenVersion: userInfo.tokenVersion
        };

        const newAccessToken = jwt.sign(payload, accessTokenSecret, { expiresIn: "15m" });
        const isProd = process.env.NODE_ENV === 'production';

        res.cookie("access_token", newAccessToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'strict' : 'lax',
            maxAge: 15 * 60 * 1000,
        });

        req.user = payload;
        return next();
    } catch (error) {
        next(error);
    }
};

export default authenticateJWT;