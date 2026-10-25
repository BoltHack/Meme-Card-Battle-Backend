import { Schema, model, InferSchemaType } from "mongoose";

const DocumentsSchema = new Schema({
  path_name: {
    type: String,
  },
  title: {
    type: String,
  },
  summary: {
    type: String,
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

export type IDocument = InferSchemaType<typeof DocumentsSchema>;

const DocumentsModel = model<IDocument>("document", DocumentsSchema);

export default DocumentsModel;
