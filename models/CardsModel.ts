import { Schema, model, InferSchemaType } from "mongoose";

const CardsSchema = new Schema({
    // card_id: { type: String },
    card_name: { type: String },
    card_avatar: { type: String },
    card_description: { type: String },
    card_stats: {
        card_damage: { type: Number },
        card_protection: { type: Number }
    },
    card_lvl_info: {
        lvl_number: { type: Number },
        lvl_name: { type: String },
    },
    power_slot: { type: Number, default: 5 }
});

CardsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ICard = InferSchemaType<typeof CardsSchema>;

const CardsModel = model<ICard>('card', CardsSchema);

export default CardsModel;