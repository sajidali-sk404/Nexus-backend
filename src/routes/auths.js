import express from "express";
import { register, login, getMe, sendOtp, verifyOtp, changePassword, forgotPassword } from "../controllers/auths.js";
import { body, validationResult } from "express-validator";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register a new user

router.post("/register", register );
router.post("/login", login);
router.get("/me", protect, getMe);
router.post("/send-otp", protect, sendOtp);
router.post("/verify-otp", protect, verifyOtp);
router.post("/change-password", protect, changePassword);
router.post("/forgot-password", forgotPassword);
export default router;