// routes/paymentRoutes.js
import express from "express";
import {
  createPaymentIntent,
  confirmPayment,
  stripeWebhook,
  depositMoney,
  withdrawMoney,
  transferMoney,
  getTransactionHistory,
  getWalletBalance,
  getTransactionDetails,
} from "../controllers/payments.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Stripe webhook (MUST be before express.json() middleware)
// Uses raw body - handle in server.js
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// ✅ Stripe payment routes
router.post("/create-payment-intent", protect, createPaymentIntent);
router.post("/confirm-payment", protect, confirmPayment);

// ✅ Regular routes
router.post("/deposit", protect, depositMoney);
router.post("/withdraw", protect, withdrawMoney);
router.post("/transfer", protect, transferMoney);
router.get("/history", protect, getTransactionHistory);
router.get("/balance", protect, getWalletBalance);
router.get("/:id", protect, getTransactionDetails);

export default router;