import express from "express";
import { getNotifications, markNotificationAsRead , markAllNotificationsAsRead, deleteNotification, clearAllNotifications } from "../controllers/notification.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ────────────────────────────────────────────────────────────────────     

router.get("/", protect, getNotifications);
router.put("/:id/read", protect, markNotificationAsRead);
router.put("/read-all", protect, markAllNotificationsAsRead);
router.delete("/:id", protect, deleteNotification);
router.delete("/", protect, clearAllNotifications);

export default router;