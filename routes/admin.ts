import express from "express";

import AdminController_View from "../controllers/admin_controller/AdminView";
import AdminController_Post from "../controllers/admin_controller/AdminPost";

import authenticateJWT from "../middlewares/authenticateJWT";
import verifyPermissions from "../middlewares/verifyPermissions";
import PageRender from "../middlewares/PageRender";

const admin = express.Router();

admin.get('/create-cards', verifyPermissions("Admin"), PageRender("auth"));

admin.post('/add-card', verifyPermissions("Admin"), authenticateJWT, AdminController_Post.CreateCardPost);

admin.post('/get-random-card', verifyPermissions("Admin"), authenticateJWT, AdminController_Post.GetRandomCardPost);

export default admin;