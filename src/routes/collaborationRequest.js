import express from "express";
import { sendCollaborationRequest, getReceivedRequests, getSentRequests, respondToRequest, cancelRequest } from "../controllers/collaborationRequest.js";

const router = express.Router();

router.post("/send", sendCollaborationRequest);
router.get("/received", getReceivedRequests);
router.get("/get-sent-requests", getSentRequests);
router.post("/:id/respond", respondToRequest);
router.delete("/:id", cancelRequest);

export default router;