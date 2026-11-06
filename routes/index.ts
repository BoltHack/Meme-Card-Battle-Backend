import express from "express";

import ViewController from "../controllers/basic_controller/ViewController";
// import PostController from "../controllers/basic_controller/PostController";

// import authenticateJWT from "../middlewares/authenticateJWT";
import CheckMaintenanceMode from "../middlewares/CheckMaintenanceMode";
import { PageRender } from "../middlewares/PageRender";
import PostController from "../controllers/basic_controller/PostController";

const router = express.Router();

router.get("/getData", CheckMaintenanceMode, ViewController.GetDataView);

router.get("/", CheckMaintenanceMode, ViewController.MainView);

router.get("/help-center", CheckMaintenanceMode, ViewController.HelpCenterView);

router.get(
  "/help-center/:help_request",
  CheckMaintenanceMode,
  ViewController.HelpCenterInfoView,
);

router.get(
  "/documents/:document",
  CheckMaintenanceMode,
  ViewController.DocumentsView,
);

router.get("/blog", CheckMaintenanceMode, ViewController.BlogView);
router.get(
  "/category/:blog_category",
  CheckMaintenanceMode,
  ViewController.BlogCategoryView,
);
router.get("/blog/:blog_id", CheckMaintenanceMode, ViewController.BlogReadView);

router.get("/ratings", CheckMaintenanceMode, PageRender("no_auth"));
router.get(
  "/ratings/wins",
  CheckMaintenanceMode,
  ViewController.RatingsView_wins,
);
router.get(
  "/ratings/balance",
  CheckMaintenanceMode,
  ViewController.RatingsView_balance,
);
router.get("/ratings/xp", CheckMaintenanceMode, ViewController.RatingsView_xp);

router.get(
  "/profile/:user_name",
  CheckMaintenanceMode,
  ViewController.ProfileView,
);

// router.get("/bot-settings", CheckMaintenanceMode, PageRender("auth"));
// router.get("/game-settings", CheckMaintenanceMode, PageRender("auth"));

router.post("/rating/search", PostController.RatingSearchPost);

export default router;
