import { Schema, model, InferSchemaType } from "mongoose";

const CardsSchema = new Schema({
    // card_id: { type: String },
    card_name: { type: String },
    card_avatar: { type: String },
    card_description: { type: String },
    card_stats: {
        card_damage: { type: Number, min: 1 },
        card_protection: { type: Number, min: 1 }
    },
    card_lvl_info: {
        lvl_number: { type: Number, min: 1 },
        lvl_name: { type: String },
    },
    power_slot: { type: Number, min: 1, default: 5 }
});

CardsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ICard = InferSchemaType<typeof CardsSchema>;

const CardsModel = model<ICard>('card', CardsSchema);

export default CardsModel;