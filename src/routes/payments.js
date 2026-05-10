import express from "express";
import { depositMoney, getTransactionHistory, getWalletBalance, getTransactionDetails, transferMoney, withdrawMoney } from "../controllers/payments.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
// ────────────────────────────────────────────────────────────────────

// @route   POST /api/payments/deposit  
// @desc    Deposit money into wallet
// @access  Private
// ────────────────────────────────────────────────────────────────────
router.post("/deposit", protect, depositMoney);
router.get("/history", protect, getTransactionHistory);
router.get("/balance", protect, getWalletBalance);
router.get("/:id", protect, getTransactionDetails);

export default router;