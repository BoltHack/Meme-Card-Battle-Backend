import express from "express";

import AdminController_View from "../controllers/admin_controller/AdminView";
import AdminController_Post from "../controllers/admin_controller/AdminPost";

import authenticateJWT from "../middlewares/authenticateJWT";
import verifyPermissions from "../middlewares/verifyPermissions";
import { PageRender } from "../middlewares/PageRender";

const admin = express.Router();

admin.get('/panel', verifyPermissions("Admin"), PageRender("auth"));
admin.get('/team', verifyPermissions("Admin"), AdminController_View.TeamView);

admin.get('/create/card', verifyPermissions("Admin"), PageRender("auth"));
admin.get('/create/blog', verifyPermissions("Admin"), PageRender("auth"));
admin.get('/edit/blog/:blog_id', verifyPermissions("Admin"), authenticateJWT, AdminController_View.EditBlogView);

admin.post('/add/card', verifyPermissions("Admin"), authenticateJWT, AdminController_Post.CreateCardPost);
admin.post('/add/blog', verifyPermissions("Admin"), authenticateJWT, AdminController_Post.BlogRedactionPost);

admin.post('/get-random-card', verifyPermissions("Admin"), authenticateJWT, AdminController_Post.GetRandomCardPost);

export default admin;