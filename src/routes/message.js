import express from "express";
import { sendMessage, getConversations , getMessages, markMessageAsRead, getUnreadCount } from "../controllers/message.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/send", protect, sendMessage);
router.get("/conversations", protect, getConversations);
router.get("/conversations/:conversationId/messages", protect, getMessages);
router.post("/messages/:messageId/read", protect, markMessageAsRead);
router.get("/unread-count", protect, getUnreadCount);

export default router;