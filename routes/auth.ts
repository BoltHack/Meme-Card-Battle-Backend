import express from "express";

import AuthController from "../controllers/basic_controller/AuthController";

import authenticateJWT from "../middlewares/authenticateJWT";
import CheckMaintenanceMode from "../middlewares/CheckMaintenanceMode";
import Validate from "../middlewares/validate"

const auth = express.Router();

auth.get("/sign-in", CheckMaintenanceMode, AuthController.SignInView);

auth.post('/registerUser', Validate.ValidateRegister, AuthController.registerNewUser);
auth.post('/loginUser', Validate.ValidateLogin, AuthController.loginUser);

auth.post('/change-password', authenticateJWT, AuthController.ChangePassword);

auth.post('/logout', authenticateJWT, AuthController.logout);
auth.post("/logout-all-accounts", authenticateJWT, AuthController.logoutAllAccounts);

export default auth;