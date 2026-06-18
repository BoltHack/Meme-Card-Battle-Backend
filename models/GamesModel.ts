import { Schema, model, InferSchemaType } from "mongoose";

const GamesSchema = new Schema({
    game_key: {
        type: String,
        unique: true
    },
    game_type: {
        type: String
    },
    game_online: {
        users: [{
            type: Schema.Types.ObjectId
        }],
        max_online: {
            type: Number
        }
    },
    users_battle_info: [{
        user_id: { type: Schema.Types.ObjectId, ref: 'User' },
        user_name: { type: String },
        user_lvl: { type: Number },
        user_health: { type: Number, default: 100 },
        user_ult: { type: Number, default: 0 },
        user_cards: {
            battle_cards: [{
                _id: false,
                card_id: { type: Schema.Types.ObjectId, ref: 'Cards' },
                user_base_card_id: { type: Schema.Types.ObjectId }
            }],
            select_card: {
                type: String
            }
        },
    }],
    bot_battle_info: {
        bot_mode: { type: String },
        bot_id: { type: String },
        bot_name: { type: String },
        bot_health: { type: Number, default: 100 },
        bot_ult: { type: Number, default: 0 },
        bot_cards: {
            battle_cards: [{
                _id: false,
                card_id: { type: Schema.Types.ObjectId, ref: 'Cards' },
                bot_base_card_id: { type: String },
            }],
            select_card: {
                type: String
            }
        },
    },
    winner: {
        type: String,
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    // expiresAt: {
    //     type: Date,
    //     index: true
    // },
});

export type IGame = InferSchemaType<typeof GamesSchema>;

const GamesModel = model<IGame>('game', GamesSchema);

export default GamesModel;