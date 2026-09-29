import express from "express";

import ViewController from "../controllers/basic_controller/ViewController";
// import PostController from "../controllers/basic_controller/PostController";

import authenticateJWT from "../middlewares/authenticateJWT";
import CheckMaintenanceMode from "../middlewares/CheckMaintenanceMode";
import { PageRender } from "../middlewares/PageRender";
import PostController from "../controllers/basic_controller/PostController";

const play = express.Router();

play.get(
  "/play",
  CheckMaintenanceMode,
  authenticateJWT,
  ViewController.PlayView,
);

play.get("/", CheckMaintenanceMode, authenticateJWT, PageRender("auth"));

play.get(
  "/profile",
  CheckMaintenanceMode,
  authenticateJWT,
  ViewController.ProfileView,
);

play.get(
  "/cases",
  CheckMaintenanceMode,
  authenticateJWT,
  ViewController.CasesView,
);

play.get(
  "/shop",
  CheckMaintenanceMode,
  authenticateJWT,
  ViewController.ShopView,
);

play.get(
  "/settings",
  CheckMaintenanceMode,
  authenticateJWT,
  ViewController.SettingsView,
);

play.get(
  "/settings/profile",
  CheckMaintenanceMode,
  authenticateJWT,
  ViewController.SettingsView_Profile,
);

play.get(
  "/settings/notifications",
  CheckMaintenanceMode,
  authenticateJWT,
  PageRender("auth"),
);

play.get(
  "/settings/graphics",
  CheckMaintenanceMode,
  authenticateJWT,
  PageRender("auth"),
);

play.get(
  "/game/:game_type/:game_key",
  CheckMaintenanceMode,
  authenticateJWT,
  ViewController.GameView,
);

play.post(
  "/cards/get/:cards_category",
  authenticateJWT,
  PostController.GetCardsPost,
);

play.post(
  "/case/:case_id/content/get",
  authenticateJWT,
  PostController.GetCaseContentPost,
);

play.post("/case/:case_id/buy", authenticateJWT, PostController.BuyCasePost);
play.post("/case/:case_id/open", authenticateJWT, PostController.OpenCasePost);

play.post(
  "/save-settings/profile",
  authenticateJWT,
  PostController.SaveSettingsProfile,
);

export default play;
