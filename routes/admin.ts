import express from "express";

import AdminController_View from "../controllers/admin_controller/AdminView";
import AdminController_Post from "../controllers/admin_controller/AdminPost";

import authenticateJWT from "../middlewares/authenticateJWT";
import verifyPermissions from "../middlewares/verifyPermissions";
import { PageRender } from "../middlewares/PageRender";

const admin = express.Router();

admin.get('/panel', authenticateJWT, verifyPermissions("Admin"), PageRender("auth"));
admin.get('/team', authenticateJWT, verifyPermissions("Admin"), AdminController_View.TeamView);

admin.get('/create/card', authenticateJWT, verifyPermissions("Admin"), PageRender("auth"));
admin.get('/create/blog', authenticateJWT, verifyPermissions("Admin"), PageRender("auth"));
admin.get('/edit/blog/:blog_id', authenticateJWT, verifyPermissions("Admin"), AdminController_View.EditBlogView);

admin.post('/add/card', authenticateJWT, verifyPermissions("Admin"), AdminController_Post.CreateCardPost);
admin.post('/add/blog', authenticateJWT, verifyPermissions("Admin"), AdminController_Post.BlogRedactionPost);

admin.post('/get-random-card', verifyPermissions("Admin"), authenticateJWT, AdminController_Post.GetRandomCardPost);

export default admin;