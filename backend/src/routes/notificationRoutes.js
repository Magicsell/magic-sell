import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { tenantMiddleware } from "../middleware/tenant.js";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notificationController.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);
router.use(tenantMiddleware);

router.get("/", getNotifications);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);
router.delete("/:id", deleteNotification);

export default router;
