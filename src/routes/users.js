import express from "express";
import { getUsers, getInvestors, getEntrepreneurs, getUser, updateUser, deleteUser } from "../controllers/users.js";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck, ownerCheck } from "../middleware/roleCheck.js";


const router = express.Router();

// ────────────────────────────────────────────────────────────────────

// @route   GET /api/users
// @desc    Get all users (for discovery — investors see entrepreneurs & vice versa)
// @access  Private
router.get("/", protect, getUsers);
router.get("/investors", protect, getInvestors);
router.get("/entrepreneurs", protect, getEntrepreneurs);
router.get("/:id", protect, getUser);
router.put("/:id", protect, ownerCheck, updateUser);
router.delete("/:id", protect, ownerCheck, deleteUser);

export default router;