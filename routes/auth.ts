import express from "express";

import AuthController from "../controllers/basic_controller/AuthController";

import authenticateJWT from "../middlewares/authenticateJWT";
import CheckMaintenanceMode from "../middlewares/CheckMaintenanceMode";
import Validate from "../middlewares/validate"

const auth = express.Router();

auth.get("/sign-in", CheckMaintenanceMode, AuthController.SignInView);

auth.post('/registerUser', Validate.validateRegister, AuthController.registerNewUser)
auth.post('/loginUser', Validate.validateLogin, AuthController.loginUser)

auth.post('/logout', authenticateJWT, AuthController.logout)

export default auth;