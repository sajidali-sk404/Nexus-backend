// routes/collaborationRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  sendCollaborationRequest,
  getReceivedRequests,
  getSentRequests,
  respondToRequest,
  cancelRequest,
} from "../controllers/collaborationRequest.js";

const router = express.Router();

// ✅ FIXED: All routes need protect middleware!
router.post("/send", protect, sendCollaborationRequest);
router.get("/received", protect, getReceivedRequests);
router.get("/get-sent-requests", protect, getSentRequests);
router.post("/:id/respond", protect, respondToRequest);
router.delete("/:id", protect, cancelRequest);

export default router;