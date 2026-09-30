import { Schema, model, InferSchemaType } from "mongoose";

const UsersSchema = new Schema({
  name: { type: String, required: true },
  requestName: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  image: { type: String, default: "" },
  role: { type: String, default: "User" },
  ip: { type: String, default: "" },

  coins: { type: Number, min: 0, default: 0 },
  money: { type: Number, min: 0, default: 0 },
  lvl: { type: Number, min: 0, max: 100, default: 1 },
  keys: [
    {
      _id: { type: Schema.Types.ObjectId },
      count: { type: Number, default: 0 },
    },
  ],

  myCards: [
    { card_id: { type: String }, quantity: { type: Number, default: 1 } },
  ],

  isOnline: { type: Boolean, default: false },
  gameInfo: { type: String, default: "Default" },

  settings: {
    profile: {
      aboutMe: { type: String, default: "" },
    },
  },

  friends: {
    list: [
      {
        _id: { type: Schema.Types.ObjectId, ref: "user" },
      },
    ],
    requestsForMe: [
      {
        _id: { type: Schema.Types.ObjectId, ref: "user" },
      },
    ],
    requestsFromMe: [
      {
        _id: { type: Schema.Types.ObjectId, ref: "user" },
      },
    ],
  },

  refreshTokenHash: { type: String, default: null },
  tokenVersion: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  // expiresAt: { type: Date }
});

// UsersSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type IUser = InferSchemaType<typeof UsersSchema>;

const UsersModel = model<IUser>("user", UsersSchema);

export default UsersModel;
