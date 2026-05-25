import express from "express";
import {
  register,
  login,
  logout,
  getMe,
  sendOtp,
  verifyOtp,
  changePassword,
  forgotPassword,
  sendTwoFactorOTP,
  verifyTwoFactorOTP,
  toggleTwoFactor,
} from "../controllers/auths.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Auth routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// 2FA routes
router.post("/2fa/send-otp", sendTwoFactorOTP);
router.post("/2fa/verify-otp", verifyTwoFactorOTP);
router.put("/2fa/toggle", protect, toggleTwoFactor);

// User routes
router.get("/me", protect, getMe);
router.post("/send-otp", protect, sendOtp);
router.post("/verify-otp", protect, verifyOtp);
router.put("/change-password", protect, changePassword);
router.post("/forgot-password", forgotPassword);

export default router;