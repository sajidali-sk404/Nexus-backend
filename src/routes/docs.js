import express from "express";
import { getDocuments, getDocument, shareDocument, signDocument, deleteDocument, uploadDocument } from "../controllers/docs.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadFile } from "../middleware/upload.js";

const router = express.Router();

// ────────────────────────────────────────────────────────────────────

// @route   GET /api/docs
// @desc    Get all documents (owned or shared)
router.get("/", protect, getDocuments);
router.post("/upload-document", protect, uploadFile.single("file"), uploadDocument);
router.get("/:id", protect, getDocument);
router.post("/:id/share", protect, shareDocument);
router.post("/:id/sign", protect, signDocument);
router.delete("/:id", protect, deleteDocument);

export default router;