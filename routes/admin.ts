import express from "express";

import AdminController_View from "../controllers/admin_controller/AdminView";
import AdminController_Post from "../controllers/admin_controller/AdminPost";

import authenticateJWT from "../middlewares/authenticateJWT";
import verifyPermissions from "../middlewares/verifyPermissions";
import { PageRender } from "../middlewares/PageRender";

const admin = express.Router();

admin.get(
  "/panel",
  authenticateJWT,
  verifyPermissions("Admin"),
  PageRender("auth"),
);
admin.get(
  "/team",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_View.TeamView,
);
admin.get(
  "/settings",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_View.SettingsView,
);

admin.get(
  "/card/list/:cards_category",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_View.CardListView,
);
admin.get(
  "/card/create",
  authenticateJWT,
  verifyPermissions("Admin"),
  PageRender("auth"),
);
admin.get(
  "/blog/create",
  authenticateJWT,
  verifyPermissions("Admin"),
  PageRender("auth"),
);
admin.get(
  "/blog/:blog_id/edit",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_View.EditBlogView,
);

admin.get(
  "/case/create",
  authenticateJWT,
  verifyPermissions("Admin"),
  PageRender("auth"),
);
admin.get(
  "/case/list",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_View.CaseListView,
);
admin.get(
  "/case/:case_id/edit/data",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_View.EditCaseDataView,
);
admin.get(
  "/case/:case_id/edit/content",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_View.EditCaseContentView,
);

admin.post(
  "/card/create",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_Post.CreateCardPost,
);
admin.post(
  "/card/:card_id/delete",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_Post.RemoveCardPost,
);

admin.post(
  "/blog/create",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_Post.BlogRedactionPost("create"),
);
admin.post(
  "/blog/:blog_id/edit",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_Post.BlogRedactionPost("edit"),
);
admin.post(
  "/blog/:blog_id/delete",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_Post.RemoveBlogPost,
);

admin.post(
  "/blog/cover/add",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_Post.AddBlogCoverPost,
);

admin.post(
  "/case/create",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_Post.CreateCasePost,
);
admin.post(
  "/case/:case_id/edit/data",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_Post.EditCaseDataPost,
);
admin.post(
  "/case/:case_id/edit/content/:action_type",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_Post.EditCaseContentPost,
);
admin.post(
  "/case/:case_id/delete",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_Post.DeleteCasePost,
);

admin.post(
  "/settings/change",
  authenticateJWT,
  verifyPermissions("Admin"),
  AdminController_Post.EditSettingsPost,
);

admin.post(
  "/get-random-card",
  verifyPermissions("Admin"),
  authenticateJWT,
  AdminController_Post.GetRandomCardPost,
);

export default admin;
