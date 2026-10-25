import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";

import { PageRender_v2 } from "../../middlewares/PageRender";

import GamesModel from "../../models/GamesModel";
import UsersModel from "../../models/UsersModel";
import BlogsModel from "../../models/BlogsModel";
import HelpsModel from "../../models/HelpsModel";
import mongoose, { Types } from "mongoose";
import App_CasesConfigModel from "../../models/admin/App_CasesConfigModel";
import App_GlobalConfigModel from "../../models/admin/App_GlobalConfigModel";
import DocumentsModel from "../../models/DocumentsModel";

interface UserData {
  id: string;
  name: string;
  role: string;
}
interface BasicData {
  locale: string;
}
interface CustomRequest extends Request {
  user?: UserData;
  basicData: BasicData;
}
interface GameInfo {
  game_type: string;
  users_battle_info: {
    _id: Types.ObjectId;
  }[];
}
interface User {
  id: string;
  name: string;
  role: string;
}

interface IUser extends Document {
  id: string;
  lvl: number;
  money: number;
  coins: number;
  myCards: {
    card_id: Types.ObjectId;
    quantity: number;
  }[];
}

interface BlogData {
  author: {
    id: string;
    name: string;
    role: string;
  };
  isVisibility: boolean;
  main_content: {
    title: string;
    description: string;
    cover: string;
  };
}
class ViewController {
  // static ReadPage_docs = (setFilePath: string) => {
  //   return async (req: CustomRequest, res: Response, next: NextFunction) => {
  //     try {
  //       const filePath = path.join(
  //         process.cwd(),
  //         "data",
  //         "docs",
  //         `${setFilePath}.md`,
  //       );

  //       if (!fs.existsSync(filePath)) {
  //         return res.status(404).json({ error: "Страница не найдена" });
  //       }

  //       const content = await fs.promises.readFile(filePath, "utf8");

  //       return PageRender_v2("no_auth", content)(req, res, next);
  //     } catch (err) {
  //       console.error("Ошибка:", err);
  //       const errorMessage =
  //         err instanceof Error ? err.message : "Неизвестная ошибка";
  //       return res.status(500).json({ error: errorMessage });
  //     }
  //   };
  // };

  // static ReadPage_json = (setFilePath: string) => {
  //   return async (req: CustomRequest, res: Response, next: NextFunction) => {
  //     try {
  //       const filePath = path.join(
  //         process.cwd(),
  //         "data",
  //         "json",
  //         `${setFilePath}.json`,
  //       );

  //       if (!fs.existsSync(filePath)) {
  //         return res.status(404).json({ error: "Страница не найдена" });
  //       }

  //       const fileContent = await fs.promises.readFile(filePath, "utf8");

  //       const content = JSON.parse(fileContent);

  //       return PageRender_v2("no_auth", content)(req, res, next);
  //     } catch (err) {
  //       console.error("Ошибка:", err);
  //       const errorMessage =
  //         err instanceof Error ? err.message : "Неизвестная ошибка";
  //       return res.status(500).json({ error: errorMessage });
  //     }
  //   };
  // };

  static GetDataView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const config = await App_GlobalConfigModel.getSettings();

      const linksData = config.links.map((links: any) => {
        return {
          id: links._id.toString(),
          name: links.name,
          link: links.link,
          icon: links.icon,
          priority: Number(links.priority),
          // main_priority: Boolean(links.main_priority),
        };
      });

      const renderData = linksData;

      return PageRender_v2("no_auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static MainView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const blog_info = await BlogsModel.find({});
      const config = await App_GlobalConfigModel.getSettings();

      const linksData = config.links
        .filter((links) => links.main_priority)
        .map((links: any) => {
          return {
            id: links._id.toString(),
            name: links.name,
            link: links.link,
            icon: links.icon,
            priority: Number(links.priority),
            main_priority: Boolean(links.main_priority),
          };
        });

      const blogData = blog_info
        // .slice(-3)
        .filter((blog) => blog.category === "news")
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3)
        .map((blog) => ({
          author: blog.author?.name,
          title: blog.main_content?.title,
          description: blog.main_content?.description,
          cover: blog.main_content?.cover,
          category: blog.category,
          date: blog.date,
          id: blog._id,
        }));
      // .reverse();

      const renderData = {
        linksData: linksData,
        blogData: blogData,
      };

      return PageRender_v2("no_auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static HelpCenterView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const help_info = await HelpsModel.find({});

      const renderData = help_info
        .filter((item) => item.isVisibility === true)
        .map((item) => {
          return {
            title: item.title,
            summary: item.summary,
            color: item?.icon?.color,
            flter: item?.icon?.filter,
            link_title: item?.link?.title,
            link_href: item?.link?.href,
            link_path: item?.link?.path,
          };
        });

      return PageRender_v2("no_auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static HelpCenterInfoView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { help_request } = req.params;

      let filteredQuery: Record<string, any> = {
        "link.path": help_request,
        $or: [{ isVisibility: true }, { isVisibility: { $exists: false } }],
      };

      const help_info = await HelpsModel.findOne(filteredQuery);

      if (!help_info) {
        return res.status(404).json({ error: "not found" });
      }

      const renderData = {
        title: help_info?.title,
        summary: help_info?.summary,
        content: help_info.content,
      };

      return PageRender_v2("no_auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static DocumentsView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { document } = req.params;

      let filteredQuery: Record<string, any> = {
        path_name: document,
        $or: [{ isVisibility: true }, { isVisibility: { $exists: false } }],
      };

      const help_info = await DocumentsModel.findOne(filteredQuery);

      if (!help_info) {
        return res.status(404).json({ error: "not found" });
      }

      const renderData = {
        title: help_info?.title,
        summary: help_info?.summary,
        content: help_info.content,
        date: help_info.date,
      };

      return PageRender_v2("no_auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static PlayView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user as any;

      const user_info = await UsersModel.findById(user.id);

      if (!user_info) {
        return res.status(404).json({ error: "Пользователь не найден." });
      }

      const renderData = {
        name: user_info?.name,
        money: user_info?.money,
        coins: user_info?.coins,
        lvl: user_info?.lvl,
        xp: user_info?.lvlXP,
      };

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static ProfileView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user as User;
      const user_info = await UsersModel.findById(user.id);

      if (!user_info) {
        return res
          .status(404)
          .json({ error: "Пользователь не найден в базе данных" });
      }

      const renderData = {
        id: user?.id || "",
        name: user?.name || "",
        role: user?.role || "",
      };

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static CasesView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user as any;

      const user_info = await UsersModel.findById(user.id);
      const case_info = await App_CasesConfigModel.getSettings();

      const cases = case_info.cases;

      const keys = new Map(
        user_info?.keys.map((k) => [k._id?.toString(), k.count]),
      );

      const caseData = cases.flatMap((cs) => {
        if (!cs.content || cs.content.length === 0) return [];

        const caseIdsStr = cs._id.toString();

        const count = keys.get(caseIdsStr) || 0;

        return [
          {
            id: cs._id.toString(),
            name: cs.name,
            description: cs.description,
            icon: cs.icon,
            rarity: cs.rarity,
            price: cs.price,
            keys: count,
          },
        ];
      });

      const renderData = {
        cases: caseData,
      };

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static ShopView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const shop_info = await App_CasesConfigModel.getSettings();

      const cases = shop_info.cases;

      const caseData = cases.flatMap((cs) => {
        if (!cs.content || cs.content.length === 0) return [];

        return [
          {
            id: cs._id.toString(),
            name: cs.name,
            description: cs.description,
            icon: cs.icon,
            rarity: cs.rarity,
            quantity: cs.quantity,
            price: cs.price,
            priority: cs.priority,
          },
        ];
      });

      return PageRender_v2("auth", caseData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static GameView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { game_type, game_key } = req.params;

      const errorMsg =
        req.basicData?.locale === "en" ? "Game not found." : "Игра не найдена.";

      const user = req.user as UserData;

      const user_info = await UsersModel.findById(user.id);
      const game = await GamesModel.findOne({ game_key: game_key }).exec();

      if (!game) {
        return res.status(404).json({ error: errorMsg });
      }

      if ((game as GameInfo)?.game_type.toString() !== game_type.toString()) {
        return res.status(404).json({ error: errorMsg });
      }

      const player_info = (game as GameInfo)?.users_battle_info.find(
        (u) => u._id.toString() === user.id,
      );
      const enemy_info = (game as GameInfo)?.users_battle_info.find(
        (u) => u._id.toString() !== user.id,
      );

      if (
        (game_type === "player_player" && !player_info) ||
        (game_type === "player_player" && !enemy_info) ||
        (game_type === "player_bot" && !player_info)
      ) {
        return res.status(404).json({ error: errorMsg });
      }

      const user_cards = (user_info as IUser)?.myCards.map((uc) => uc.quantity);
      const user_cards_count = (user_cards as number[])?.reduce(
        (acc, curr) => acc + curr,
        0,
      );

      if (user_cards_count < 8) {
        return res
          .status(403)
          .json({ error: "У вас недостаточно карт, чтобы начать игру." });
      }

      res.json({
        id: user.id,
        name: user.name,
        game_key: game_key,
        locale: req.basicData?.locale,
      });
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static BlogView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const pageQuery = parseInt(req.query.page as string, 7);
      const page = isNaN(pageQuery) || pageQuery < 1 ? 1 : pageQuery;

      const limit = 7;
      const skip = (page - 1) * limit;

      let filteredQuery: Record<string, any> = {
        $or: [{ isVisibility: true }, { isVisibility: { $exists: false } }],
        "main_content.title": { $exists: true, $ne: "" },
        "main_content.description": { $exists: true, $ne: "" },
        category: { $ne: "news" },
      };

      const [allBlogs, totalBlogs] = await Promise.all([
        BlogsModel.find(filteredQuery)
          .sort({ date: -1 })
          .skip(skip)
          .limit(limit),
        BlogsModel.countDocuments(filteredQuery),
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

  static BlogCategoryView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { blog_category } = req.params;

      const pageQuery = parseInt(req.query.page as string, 7);
      const page = isNaN(pageQuery) || pageQuery < 1 ? 1 : pageQuery;
      // const page = parseInt(req.query.page) || 1;
      const limit = 7;
      const skip = (page - 1) * limit;

      const filteredQuery: Record<string, any> = {
        category: blog_category,
        $or: [{ isVisibility: true }, { isVisibility: { $exists: false } }],
        "main_content.title": { $exists: true, $ne: "" },
        "main_content.description": { $exists: true, $ne: "" },
      };

      const [allBlogs, totalBlogs] = await Promise.all([
        BlogsModel.find(filteredQuery)
          .sort({ date: -1 })
          .skip(skip)
          .limit(limit),
        BlogsModel.countDocuments(filteredQuery),
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
        // totalPages: Math.ceil(totalBlogs / limit),
        totalPages: Math.max(1, Math.ceil(totalBlogs / limit)),
      };

      return PageRender_v2("no_auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static BlogReadView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { blog_id } = req.params as string;

      const errorMsg = "Страница не найдена.";

      if (!blog_id || !mongoose.Types.ObjectId.isValid(blog_id)) {
        return res.status(404).json({ error: errorMsg });
      }

      const blogRead = await BlogsModel.findById(blog_id);

      if (!blogRead || (blogRead as BlogData)?.isVisibility === false) {
        return res.status(404).json({ error: errorMsg });
      }

      if (
        !(blogRead as BlogData)?.main_content ||
        !(blogRead as BlogData)?.main_content.description
      ) {
        return res.status(404).json({ error: errorMsg });
      }

      const user_info = await UsersModel.findById(blogRead?.author?.id);

      const renderData = {
        author: {
          id: blogRead?.author?.id as BlogData,
          name: blogRead?.author?.name as BlogData,
          role: user_info?.role,
          avatar: user_info?.image,
        },
        title: blogRead?.main_content?.title as BlogData,
        description: blogRead?.main_content?.description as BlogData,
        cover: blogRead?.main_content?.cover as BlogData,
        category: blogRead?.category as BlogData,
        date: blogRead?.date as BlogData,
        content: blogRead?.content as BlogData,
      };

      return PageRender_v2("no_auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static RatingsView_wins = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const users_info = await UsersModel.find({ wins: { $gt: 0 } })
        .sort({ wins: -1 })
        .limit(100);

      const renderData = users_info
        .sort((a, b) => b.wins - a.wins)
        .map((user) => {
          return {
            lvl: user.lvl,
            name: user.name,
            value: user.wins,
            // units: "побед",
          };
        });

      return res.status(200).json({ renderData: renderData });
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  // let cachedRatings: any = null;
  // let lastFetchTime = 0;
  // const CACHE_DURATION = 10 * 60 * 1000;

  // static async RatingsView_wins(req: Request, res: Response, next: NextFunction) {
  //   try {
  //     const currentTime = Date.now();

  //     if (!cachedRatings || (currentTime - lastFetchTime) > CACHE_DURATION) {
  //       const users_info = await UsersModel.find({ wins: { $gt: 0 } })
  //         .sort({ wins: -1 })
  //         .limit(4);

  //       cachedRatings = users_info
  //         .sort((a, b) => b.wins - a.wins)
  //         .map(user => ({
  //           lvl: user.lvl,
  //           name: user.name,
  //           value: user.wins,
  //           units: "побед"
  //         }));

  //       lastFetchTime = currentTime;
  //     }

  //     return res.status(200).json({ renderData: cachedRatings });

  //   } catch (err) {
  //     console.error("Ошибка:", err);
  //     const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка";
  //     return res.status(500).json({ error: errorMessage });
  //   }
  // }

  static RatingsView_balance = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const users_info = await UsersModel.find({ money: { $gt: 0 } })
        .sort({ money: -1 })
        .limit(100);

      const renderData = users_info
        .sort((a, b) => b.money - a.money)
        .map((user) => {
          return {
            lvl: user.lvl,
            name: user.name,
            value: user.money,
            // units: "валюты",
          };
        });

      return res.status(200).json({ renderData: renderData });
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static RatingsView_xp = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const users_info = await UsersModel.find({ lvlXP: { $gt: 0 } })
        .sort({ lvlXP: -1 })
        .limit(100);

      const renderData = users_info
        .sort((a, b) => b.lvlXP - a.lvlXP)
        .map((user) => {
          return {
            lvl: user.lvl,
            name: user.name,
            value: user.lvlXP,
            // units: "Опыта",
          };
        });

      return res.status(200).json({ renderData: renderData });
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static SettingsView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user as any;
      const user_info = await UsersModel.findById(user.id);

      if (!user_info) {
        return res.status(404).json({ error: "Пользователь не найден." });
      }

      const renderData = {
        name: user_info?.name,
        avatar: user_info?.image,
        createdAt: user_info?.createdAt,
      };

      return PageRender_v2("auth", renderData)(req, res, next);
      // return res.status(200).json({  });
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static SettingsView_Profile = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user as any;
      const user_info = await UsersModel.findById(user.id);

      if (!user_info) {
        return res.status(404).json({ error: "Пользователь не найден." });
      }

      const renderData = {
        avatar: user_info?.image,
        aboutMe: user_info?.settings?.profile?.aboutMe,
      };

      // res.status(200).json({ success: "Данные отправлены", renderData: renderData });

      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  };

  static FriendListView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user as any;
      const user_info = await UsersModel.findById(user.id);

      if (!user_info) {
        return res.status(404).json({ error: "Пользователь не найден." });
      }

      const userFriendIds = user_info?.friends?.list.map((fr) =>
        fr._id.toString(),
      );

      const players = await UsersModel.find({ _id: { $in: userFriendIds } });

      const list = players.map((u) => {
        return {
          id: u?.id,
          name: u?.name,
          lvl: u?.lvl,
          gameInfo: u?.gameInfo,
          isOnline: u?.isOnline,
        };
      });

      const renderData = {
        list: list,
        friendListLength: user_info.friends.list.length ?? 0,
        requestsForMeListLength: user_info.friends.requestsForMe.length ?? 0,
      };

      // return res
      //   .status(200)
      //   .json({ success: "Данные отправлены.", renderData: renderData });
      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static RequestsForMeListView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user as any;
      const user_info = await UsersModel.findById(user.id);

      if (!user_info) {
        return res.status(404).json({ error: "Пользователь не найден." });
      }

      const userFriendIds = user_info?.friends?.requestsForMe.map((fr) =>
        fr._id.toString(),
      );

      const players = await UsersModel.find({ _id: { $in: userFriendIds } });

      const list = players.map((u) => {
        return {
          id: u?.id,
          name: u?.name,
          lvl: u?.lvl,
          gameInfo: u?.gameInfo,
          isOnline: u?.isOnline,
        };
      });

      const renderData = {
        list: list,
        friendListLength: user_info.friends.list.length ?? 0,
        requestsForMeListLength: user_info.friends.requestsForMe.length ?? 0,
      };

      // return res
      //   .status(200)
      //   .json({ success: "Данные отправлены.", renderData: renderData });
      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static RequestsFromMeListView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user as any;
      const user_info = await UsersModel.findById(user.id);

      if (!user_info) {
        return res.status(404).json({ error: "Пользователь не найден." });
      }

      const userFriendIds = user_info?.friends?.requestsFromMe.map((fr) =>
        fr._id.toString(),
      );

      const players = await UsersModel.find({ _id: { $in: userFriendIds } });

      const list = players.map((u) => {
        return {
          id: u?.id,
          name: u?.name,
          lvl: u?.lvl,
          gameInfo: u?.gameInfo,
          isOnline: u?.isOnline,
        };
      });

      const renderData = {
        list: list,
        friendListLength: user_info?.friends?.list.length ?? 0,
        requestsForMeListLength: user_info?.friends?.requestsForMe.length ?? 0,
      };

      // return res
      //   .status(200)
      //   .json({ success: "Данные отправлены.", renderData: renderData });
      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };

  static IsOnlineListView = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user as any;
      const user_info = await UsersModel.findById(user.id);

      if (!user_info) {
        return res.status(404).json({ error: "Пользователь не найден." });
      }

      const userFriendIds = user_info?.friends?.list.map((fr) =>
        fr._id.toString(),
      );

      const players = await UsersModel.find({ _id: { $in: userFriendIds } });

      const list = players
        .filter((u) => u.isOnline)
        .map((u) => {
          return {
            id: u?.id,
            name: u?.name,
            lvl: u?.lvl,
            gameInfo: u?.gameInfo,
            isOnline: u?.isOnline,
          };
        });

      const renderData = {
        list: list,
        friendListLength: user_info.friends.list.length ?? 0,
        requestsForMeListLength: user_info.friends.requestsForMe.length ?? 0,
      };

      // return res
      //   .status(200)
      //   .json({ success: "Данные отправлены.", renderData: renderData });
      return PageRender_v2("auth", renderData)(req, res, next);
    } catch (err) {
      console.error("Ошибка:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      return res.status(500).json({ error: errorMessage });
    }
  };
}

export default ViewController;
