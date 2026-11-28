import { Schema, model, InferSchemaType } from "mongoose";

const HelpsSchema = new Schema({
  title: {
    type: String,
  },
  summary: {
    type: String,
  },
  icon: {
    color: { type: String },
    filter: { type: String },
  },
  link: {
    title: { type: String },
    href: { type: String },
    path: {
      type: String,
      // match: [/^[A-Za-z0-9\s.,!?'-]*$/]
    },
  },
  content: { type: String },
  isVisibility: {
    type: Boolean,
    default: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

export type IHelp = InferSchemaType<typeof HelpsSchema>;

const HelpsModel = model<IHelp>("help", HelpsSchema);

export default HelpsModel;
