import { Schema, model, InferSchemaType, Model } from "mongoose";

export type IAppSettings = InferSchemaType<typeof AppSchema>;

interface IAppModel extends Model<IAppSettings> {
  getSettings(): Promise<
    mongoose.Document<unknown, {}, IAppSettings> & IAppSettings
  >;
}

const AppSchema = new Schema(
  {
    _id: { type: String, default: "global_config" },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    require2FA: {
      type: Boolean,
      default: false,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false },
);

AppSchema.statics.getSettings = async function (
  this: IAppModel,
) {
  let settings = await this.findById("global_config");
  if (!settings) {
    settings = await this.create({ _id: "global_config" });
  }
  return settings;
};

const AppModel = model<IAppSettings, IAppModel>(
  "app",
  AppSchema,
);

export default AppModel;