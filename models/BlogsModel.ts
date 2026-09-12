import { Schema, model, InferSchemaType } from "mongoose";

// const coverSchema = new Schema(
//   {
//     path: { type: String },
//   },
//   { _id: false },
// );

const BlogSchema = new Schema({
  author: {
    id: {
      type: String,
    },
    name: {
      type: String,
    },
  },
  main_content: {
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    cover: {
      type: String,
      default: "",
    },
  },
  content: {
    type: String,
  },
  category: {
    type: String,
  },
  // covers: [coverSchema],
  isVisibility: {
    type: Boolean,
    default: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// newsSchema.index({ fullDate: -1 });
// newsSchema.index({ 'tags.tagName': -1 });

// const BlogModel = model('blog', BlogSchema);

export type IBlog = InferSchemaType<typeof BlogSchema>;

const BlogsModel = model<IBlog>('blog', BlogSchema);

export default BlogsModel;