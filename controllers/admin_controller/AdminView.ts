import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import { PageRender_v2 } from "../../middlewares/PageRender";

import BlogsModel from "../../models/BlogsModel";
import UsersModel from "../../models/UsersModel";
import CardsModel from "../../models/CardsModel";
import HelpsModel from "../../models/HelpsModel";
import DocumentsModel from "../../models/DocumentsModel";

import App_GlobalConfigModel from "../../models/admin/App_GlobalConfigModel";
import App_CasesConfigModel from "../../models/admin/App_CasesConfigModel";

interface UserData {
  id: string;
  name: string;
}
interface BasicData {
  locale: string;
}
interface CustomRequest extends Request {
  user?: UserData;
  basicData: BasicData;
}
class AdminController_View {
  static BlogListView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { article_type } = req.params;
      const pageQuery = parseInt(req.query.page as string, 7);
      const page = isNaN(pageQuery) || pageQuery < 1 ? 1 : pageQuery;

      const limit = 7;
      const skip = (page - 1) * limit;

      const [allBlogs, totalBlogs] = await Promise.all([
        BlogsModel.find(
          article_type === "blog"
            ? { category: { $ne: "news" } }
            : { category: { $eq: "news" } },
        )
          .sort({ date: -1 })
          .skip(skip)
          .limit(limit),
        BlogsModel.countDocuments(
          article_type === "blog"
            ? { category: { $ne: "news" } }
            : { category: { $eq: "news" } },
        ),
      ]);

      const blogsData = allBlogs.map((blog) => ({
        author: blog.author?.name,
        title: blog.main_content?.title,
        description: blog.main_content?.description,
        cover: blog.main_content?.cover,
        category: blog.category,
        date: blog.date,
        id: blog._id,
      }));

      const renderData = {
        blog: blogsData,
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(totalBlogs / limit)),
      };
      return PageRender_v2("no_auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static EditBlogView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { blog_id } = req.params;

      const errorMsg = "Страница не найдена.";

      if (!mongoose.Types.ObjectId.isValid(blog_id)) {
        return res.status(404).json({ error: errorMsg });
      }

      const blogRead = await BlogsModel.findById(blog_id);

      if (!blogRead || blogRead.isVisibility === false) {
        return res.status(404).json({ error: errorMsg });
      }

      if (!blogRead.main_content || !blogRead.main_content.description) {
        return res.status(404).json({ error: errorMsg });
      }

      const blogData = {
        title: blogRead.main_content?.title,
        description: blogRead.main_content?.description,
        cover: blogRead.main_content?.cover,
        category: blogRead.category,
        date: blogRead.date,
        content: blogRead.content,
      };

      // return res.status(200).json({
      //   blog: blogData,
      // });
      return PageRender_v2("auth", blogData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static TeamView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const allStaff = await UsersModel.find({ role: { $in: ["Admin"] } });

      const renderData = allStaff.map((staff) => ({
        id: staff.id,
        name: staff.name,
        image: staff.image,
        role: staff.role,
      }));

      // const renderData = {
      //     staffData: staffData
      // }

      // return res.status(200).json({ success: "123"});

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static CardListView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { cards_category } = req.params;

      const cardQuery = {};

      if (cards_category !== "all") {
        cardQuery["card_lvl_info.lvl_name"] =
          String(cards_category).toUpperCase();
      }

      const allCards = await CardsModel.find(cardQuery);

      const cardsData = allCards.map((card) => ({
        card_id: card._id.toString(),
        card_name: card.card_name,
        card_avatar: card.card_avatar,
        card_description: card.card_description,
        card_damage: card.card_stats.card_damage,
        card_protection: card.card_stats.card_protection,
        lvl_number: card.card_lvl_info.lvl_number,
        lvl_name: card.card_lvl_info.lvl_name,
        power_slot: card.power_slot,
      }));

      const renderData = {
        card: cardsData,
      };
      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static SettingsView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const config = await App_GlobalConfigModel.getSettings();

      const renderData = config;

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static CaseListView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const config = await App_CasesConfigModel.getSettings();

      const renderData = config;

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static EditCaseDataView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { case_id } = req.params;

      const errorMsg = "Страница не найдена.";

      if (!mongoose.Types.ObjectId.isValid(case_id)) {
        return res.status(404).json({ error: errorMsg });
      }

      const case_info = await App_CasesConfigModel.findById("cases_config_app");

      // const caseIndex = case_info.cases.findIndex(c => c._id.toString() === case_id.toString());
      const caseIndex = case_info.cases.findIndex(
        (c) => c._id.toString() === case_id.toString(),
      );

      // console.log("caseIndex", caseIndex);

      const case_data = case_info.cases[caseIndex];

      const renderData = {
        name: case_data.name,
        description: case_data.description,
        icon: case_data.icon,
        rarity: case_data.rarity,
        quantity: case_data.quantity,
        price: case_data.price,
        priority: case_data.priority,
      };

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static EditCaseContentView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { case_id } = req.params;

      const errorMsg = "Страница не найдена.";

      if (!mongoose.Types.ObjectId.isValid(case_id)) {
        return res.status(404).json({ error: errorMsg });
      }

      const case_info = await App_CasesConfigModel.findById("cases_config_app");

      const caseIndex = case_info.cases.findIndex(
        (c) => c._id.toString() === case_id.toString(),
      );

      const case_data = case_info.cases[caseIndex];

      const cardIds = case_data.content.map((c) => c._id.toString());

      const case_cards = await CardsModel.find({ _id: { $in: cardIds } });

      const formattedCardsArray = case_cards.flatMap((card) => {
        const isRandom = case_data.content.find(
          (c) => c._id.toString() === card._id.toString(),
        );
        const chance = isRandom.chance;

        return {
          id: card.id,
          name: card.card_name,
          description: card.card_description || "",
          avatar: card.card_avatar,
          lvl: card.card_lvl_info?.lvl_number || 1,
          rarity: card.card_lvl_info?.lvl_name || "Default",
          damage: card.card_stats?.card_damage || 0,
          protection: card.card_stats?.card_protection || 0,
          power_slot: card.power_slot || 5,
          chance: chance,
        };
      });

      const renderData = {
        case_name: case_data.name,
        cards: formattedCardsArray,
      };
      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static LinksListView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const config = await App_GlobalConfigModel.getSettings();

      const renderData = config.links.map((links: any) => {
        return {
          id: links._id.toString(),
          name: links.name,
          link: links.link,
          icon: links.icon,
          priority: String(links.priority),
          main_priority: Boolean(links.main_priority),
        };
      });

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static EditLinkView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { link_id } = req.params;

      const errorMsg = "Страница не найдена.";

      if (!mongoose.Types.ObjectId.isValid(link_id)) {
        return res.status(404).json({ error: errorMsg });
      }

      const link_info = await App_GlobalConfigModel.getSettings();

      const linkIndex = link_info.links.findIndex(
        (c) => c._id.toString() === link_id.toString(),
      );

      const link_data = link_info.links[linkIndex];

      const renderData = {
        name: link_data.name,
        link: link_data.link,
        icon: link_data.icon,
        priority: link_data.priority,
        main_priority: link_data.main_priority,
      };

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static HelpListView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const config = await HelpsModel.find({});

      const renderData = config.map((item: any) => {
        return {
          id: item._id.toString(),
          title: item.title,
          summary: item.summary,
          isVisibility: item.isVisibility,
        };
      });

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static EditHelpView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { help_id } = req.params;

      const config = await HelpsModel.findById(help_id);

      if (!config) {
        return res.status(404).json({ error: "Данные не найдены." });
      }

      const renderData = {
        id: config._id.toString(),
        title: config.title || "",
        summary: config.summary || "",
        color: config?.icon.color || "",
        filter: config?.icon.filter || "",
        link_title: config?.link.title || "",
        link_href: config?.link.href || "",
        link_path: config?.link.path || "",
        content: config.content || "",
      };

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static DocumentsListView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const config = await DocumentsModel.find({});

      const renderData = config.map((item: any) => {
        return {
          id: item._id.toString(),
          path_name: item.path_name,
          title: item.title,
          summary: item.summary,
          isVisibility: item.isVisibility,
        };
      });

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static EditDocumentsView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { document_id } = req.params;

      const config = await DocumentsModel.findById(document_id);

      if (!config) {
        return res.status(404).json({ error: "Данные не найдены." });
      }

      const renderData = {
        id: config._id.toString(),
        path_name: config.path_name || "",
        title: config.title || "",
        summary: config.summary || "",
        content: config.content || "",
      };

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static LogsView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const date = new Date();

      const getDay = date.getDate();
      const getMonth = date.getMonth() + 1;
      const getYear = date.getFullYear();

      const filePath = path.join(
        process.cwd(),
        "logs",
        `combined-${getYear}-${getMonth}-${getDay}.log`,
      );

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Страница не найдена" });
      }

      const content = await fs.promises.readFile(filePath, "utf8");

      return PageRender_v2("auth", content)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };
}

export default AdminController_View;
