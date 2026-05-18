import express from "express";
import { 
  sendMessage, 
  getConversations, 
  getMessages, 
  markMessageAsRead, 
  getUnreadCount 
} from "../controllers/message.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ FIXED: Routes now match the controllers
router.post("/send", protect, sendMessage);                    // POST /api/messages/send
router.get("/conversations", protect, getConversations);       // GET  /api/messages/conversations
router.get("/unread-count", protect, getUnreadCount);          // GET  /api/messages/unread-count
router.get("/:userId", protect, getMessages);                  // GET  /api/messages/:userId
router.put("/:messageId/read", protect, markMessageAsRead);    // PUT  /api/messages/:messageId/read

// ⚠️ IMPORTANT: "/unread-count" and "/conversations" MUST be BEFORE "/:userId"
// Otherwise Express thinks "conversations" is a userId!

export default router;