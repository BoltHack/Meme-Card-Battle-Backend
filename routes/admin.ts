import express from "express";

import AdminController_View from "../controllers/admin_controller/AdminView";
import AdminController_Post from "../controllers/admin_controller/AdminPost";

import authenticateJWT from "../middlewares/authenticateJWT";
import verifyPermissions from "../middlewares/verifyPermissions";
import { PageRender } from "../middlewares/PageRender";

const admin = express.Router();

admin.get('/panel', authenticateJWT, verifyPermissions("Admin"), PageRender("auth"));
admin.get('/team', authenticateJWT, verifyPermissions("Admin"), AdminController_View.TeamView);

admin.get('/card/list/:cards_category', authenticateJWT, verifyPermissions("Admin"), AdminController_View.CardListView);
admin.get('/card/create', authenticateJWT, verifyPermissions("Admin"), PageRender("auth"));
admin.get('/blog/create', authenticateJWT, verifyPermissions("Admin"), PageRender("auth"));
admin.get('/blog/:blog_id/edit', authenticateJWT, verifyPermissions("Admin"), AdminController_View.EditBlogView);

admin.post('/card/create', authenticateJWT, verifyPermissions("Admin"), AdminController_Post.CreateCardPost);
admin.post('/card/:card_id/delete', authenticateJWT, verifyPermissions("Admin"), AdminController_Post.RemoveCardPost);

admin.post('/blog/create', authenticateJWT, verifyPermissions("Admin"), AdminController_Post.BlogRedactionPost("create"));
admin.post('/blog/:blog_id/edit', authenticateJWT, verifyPermissions("Admin"), AdminController_Post.BlogRedactionPost("edit"));
admin.post('/blog/:blog_id/delete', authenticateJWT, verifyPermissions("Admin"), AdminController_Post.RemoveBlogPost);

admin.post('/get-random-card', verifyPermissions("Admin"), authenticateJWT, AdminController_Post.GetRandomCardPost);

export default admin;