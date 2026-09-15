import { Schema, model, InferSchemaType, Model } from "mongoose";

export type IAppSettings = InferSchemaType<typeof App_CasesConfigSchema>;

interface IAppModel extends Model<IAppSettings> {
  getSettings(): Promise<
    mongoose.Document<unknown, {}, IAppSettings> & IAppSettings
  >;
}

const App_CasesConfigSchema = new Schema(
  {
    _id: { type: String, default: "cases_config_app" },
    cases: [
      {
        name: String,
        description: String,
        icon: String,
        rarity: String,
        price: String,
        content: [
          {
            _id: Schema.Types.ObjectId,
            chance: Number,
          },
        ],
      },
    ],
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false },
);

App_CasesConfigSchema.statics.getSettings = async function (this: IAppModel) {
  let settings = await this.findById("cases_config_app");
  if (!settings) {
    settings = await this.create({ _id: "cases_config_app" });
  }
  return settings;
};

const App_CasesConfigModel = model<IAppSettings, IAppModel>(
  "cases_config_app",
  App_CasesConfigSchema,
);

export default App_CasesConfigModel;
