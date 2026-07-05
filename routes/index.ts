import express from "express";

import ViewController from "../controllers/basic_controller/ViewController";
import PostController from "../controllers/basic_controller/PostController";

import authenticateJWT from "../middlewares/authenticateJWT";
import PageRender from "../middlewares/PageRender";

const router = express.Router();

router.get('/', PageRender("no_auth"));
router.get('/how-to-play', PageRender("no_auth"));

router.get('/terms-of-use', PageRender("public"), ViewController.RulesPageView("terms-of-use"));
router.get('/privacy-policy', PageRender("public"), ViewController.RulesPageView("privacy-policy"));

router.get('/bot-settings', PageRender("auth"));
router.get('/game-settings', PageRender("auth"));

// router.get('/game/:adversary', authenticateJWT, ViewController.GameView);
router.get('/game/:game_type/:game_key', authenticateJWT, ViewController.GameView);

router.post('/play-game/:game_type', authenticateJWT, PostController.PlayGame);

export default router;