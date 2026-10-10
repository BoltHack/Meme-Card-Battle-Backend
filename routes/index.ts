import express from "express";

import ViewController from "../controllers/basic_controller/ViewController";
// import PostController from "../controllers/basic_controller/PostController";

// import authenticateJWT from "../middlewares/authenticateJWT";
import CheckMaintenanceMode from "../middlewares/CheckMaintenanceMode";
import { PageRender } from "../middlewares/PageRender";
// import PostController from "../controllers/basic_controller/PostController";

const router = express.Router();

router.get("/getData", CheckMaintenanceMode, ViewController.GetDataView);

router.get("/", CheckMaintenanceMode, ViewController.MainView);

router.get(
  "/help-center",
  CheckMaintenanceMode,
  ViewController.ReadPage_json("help-center_categories"),
);

router.get(
  "/how-to-play",
  CheckMaintenanceMode,
  ViewController.ReadPage_docs("how-to-play"),
);

router.get(
  "/terms-of-use",
  CheckMaintenanceMode,
  ViewController.ReadPage_docs("terms-of-use"),
);
router.get(
  "/privacy-policy",
  CheckMaintenanceMode,
  ViewController.ReadPage_docs("privacy-policy"),
);
router.get(
  "/cookie-policy",
  CheckMaintenanceMode,
  ViewController.ReadPage_docs("cookie-policy"),
);

router.get("/blog", CheckMaintenanceMode, ViewController.BlogView);
router.get(
  "/category/:blog_category",
  CheckMaintenanceMode,
  ViewController.BlogCategoryView,
);
router.get("/blog/:blog_id", CheckMaintenanceMode, ViewController.BlogReadView);

router.get("/bot-settings", CheckMaintenanceMode, PageRender("auth"));
router.get("/game-settings", CheckMaintenanceMode, PageRender("auth"));

// router.get('/game/:adversary', authenticateJWT, ViewController.GameView);

// router.post('/play-game/:game_type', authenticateJWT, PostController.PlayGame);

export default router;
