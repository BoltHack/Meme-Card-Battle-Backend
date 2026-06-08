import { Schema, model, InferSchemaType } from "mongoose";

// interface IUser {
//     name: string;
//     friendName: string;
//     email: string;
//     password?: string;
//     image: string;
//     registerDate: Date;
//     refreshTokenHash: string | null;
//     tokenVersion: number;
//     role: string;
//     ip: string;
//     onlineMod?: string;
//     createdAt: Date;
//     expiresAt?: Date;
// }

// const UserCardSchema = new Schema({
//     card_id: { type: Schema.Types.ObjectId, ref: "Card" }
// }, { _id: false });

const UsersSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    lvl: {
        type: Number,
        default: 0
    },
    requestName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    image: {
        type: String,
        default: ""
    },
    myCards: [{
        // card_id: { type: Schema.Types.ObjectId },
        card_id: { type: String },
    }],
    role: {
        type: String,
        default: "User"
    },
    ip: {
        type: String,
        default: ""
    },
    refreshTokenHash: {
        type: String,
        default: null
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
    },
});

UsersSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type IUser = InferSchemaType<typeof UsersSchema>;

const UsersModel = model<IUser>('user', UsersSchema);

export default UsersModel;