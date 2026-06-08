import express from "express";

import ViewController from "../controllers/basic_controller/ViewController";
import PostController from "../controllers/basic_controller/PostController";

import authenticateJWT from "../middlewares/authenticateJWT";

const router = express.Router();

router.get('/', ViewController.MainView);
router.get('/how-to-play', authenticateJWT, ViewController.HowToPlayView);
router.get('/bot-settings', authenticateJWT, ViewController.BotSettingsView);
// router.get('/game/:adversary', authenticateJWT, ViewController.GameView);
router.get('/game/:game_type/:game_key', authenticateJWT, ViewController.GameView);

router.post('/play-game/:game_type', authenticateJWT, PostController.PlayGame);

export default router;