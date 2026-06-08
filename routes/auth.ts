import express from "express";

import AuthController from "../controllers/basic_controller/AuthController";
import Validate from "../middlewares/validate"

const auth = express.Router();

auth.get('/sign-in', AuthController.SignInView);

auth.post('/registerUser', Validate.validateRegister, AuthController.registerNewUser)
auth.post('/loginUser', Validate.validateLogin, AuthController.loginUser)

auth.post('/logout', AuthController.logout)

export default auth;