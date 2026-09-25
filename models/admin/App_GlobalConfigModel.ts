import { Schema, model, InferSchemaType, Model } from "mongoose";

export type IAppSettings = InferSchemaType<typeof App_GlobalConfigSchema>;

interface IAppModel extends Model<IAppSettings> {
  getSettings(): Promise<
    mongoose.Document<unknown, {}, IAppSettings> & IAppSettings
  >;
}

const App_GlobalConfigSchema = new Schema(
  {
    _id: { type: String, default: "global_config_app" },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    require2FA: {
      type: Boolean,
      default: false,
    },
    links: [{
      name: { type: String },
      link: { type: String },
      icon: { type: String },
      priority: { type: Number, default: 1, min: 1 },
      main_priority: { type: Boolean, default: false }
    }],
    // casesState: {
    //   defaultCase: [
    //     {
    //       _id: Schema.Types.ObjectId,
    //       chance: Number,
    //     },
    //   ],
    //   rareCase: [
    //     {
    //       _id: Schema.Types.ObjectId,
    //       chance: Number,
    //     },
    //   ],
    // },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false },
);

App_GlobalConfigSchema.statics.getSettings = async function (this: IAppModel) {
  let settings = await this.findById("global_config_app");
  if (!settings) {
    settings = await this.create({ _id: "global_config_app" });
  }
  return settings;
};

const App_GlobalConfigModel = model<IAppSettings, IAppModel>(
  "global_config_app",
  App_GlobalConfigSchema,
);

export default App_GlobalConfigModel;