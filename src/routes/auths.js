import express from "express";
import {
    register, login, logout, sendTwoFactorOTP,
    verifyTwoFactorOTP,
    toggleTwoFactor, getMe, sendOtp, verifyOtp, changePassword, forgotPassword
} from "../controllers/auths.js";
import { body, validationResult } from "express-validator";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register a new user

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// ✅ 2FA routes
router.post('/2fa/send-otp', sendTwoFactorOTP);
router.post('/2fa/verify-otp', verifyTwoFactorOTP);
router.put('/2fa/toggle', protect, toggleTwoFactor);

router.get("/me", protect, getMe);
router.post("/send-otp", protect, sendOtp);
router.post("/verify-otp", protect, verifyOtp);
router.post("/change-password", protect, changePassword);
router.post("/forgot-password", forgotPassword);
export default router;