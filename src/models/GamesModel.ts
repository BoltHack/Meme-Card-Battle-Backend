import { Schema, model, InferSchemaType } from "mongoose";

const GamesSchema = new Schema({
  game_key: {
    type: String,
    unique: true,
  },
  game_type: {
    type: String,
  },
  game_online: {
    users: [
      {
        type: Schema.Types.ObjectId,
      },
    ],
    max_online: {
      type: Number,
    },
  },
  users_battle_info: [
    {
      // user_id: { type: Schema.Types.ObjectId, ref: 'User' },
      user_name: { type: String },
      user_avatar: { type: String },
      user_type: { type: String, Default: "Player" },
      user_isReady: { type: Boolean, Default: false },
      user_lvl: { type: Number },
      user_health: { type: Number, default: 500 },
      user_ult: { type: Number, default: 0 },
      user_cards: {
        cards_power: { type: Number, default: 0 },
        battle_cards: [
          {
            _id: false,
            card_id: { type: Schema.Types.ObjectId, ref: "Cards" },
            user_base_card_id: { type: Schema.Types.ObjectId },
            // user_base_card_id: { type: String }
          },
        ],
        select_card: {
          type: String,
        },
      },
    },
  ],
  game_started: {
    type: Boolean,
    default: false,
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

const GamesModel = model<IGame>("game", GamesSchema);

export default GamesModel;
