import express from 'express'
import Transaction from "../models/Transaction.js";
import mongoose from "mongoose";

// ── Stripe setup (uses sandbox/test key from .env) ─────────────────
let stripe;
try {
  stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
} catch {
  console.warn("⚠️  Stripe not installed. Run: npm install stripe");
}

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/payments/deposit
// @desc    Deposit money (create Stripe Payment Intent)
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const depositMoney = async (req, res) => {
  try {
    const { amount, currency = "usd", paymentMethod = "mock" } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required." });
    }

    let stripePaymentIntentId = null;

    // Create Stripe Payment Intent (if Stripe is configured)
    if (stripe && process.env.STRIPE_SECRET_KEY && paymentMethod !== "mock") {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency,
        metadata: { userId: req.user._id.toString(), type: "deposit" },
      });
      stripePaymentIntentId = paymentIntent.id;
    }

    // Save transaction to DB
    const transaction = await Transaction.create({
      to: req.user._id,
      amount,
      currency: currency.toUpperCase(),
      type: "deposit",
      status: paymentMethod === "mock" ? "completed" : "pending", // mock = instant complete
      stripePaymentIntentId,
      paymentMethod,
      description: `Deposit of ${currency.toUpperCase()} ${amount}`,
    });

    res.status(201).json({
      success: true,
      transaction,
      ...(stripePaymentIntentId && { clientSecret: `pi_mock_secret_${stripePaymentIntentId}` }),
    });
  } catch (error) {
    console.error("Deposit error:", error);
    res.status(500).json({ success: false, message: error.message || "Payment failed." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/payments/withdraw
// @desc    Withdraw money
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const withdrawMoney = async (req, res) => {
  try {
    const { amount, currency = "usd", description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required." });
    }

    // Check wallet balance
    const balance = await getWalletBalance(req.user._id);
    if (balance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: $${balance.toFixed(2)}`,
      });
    }

    const transaction = await Transaction.create({
      from: req.user._id,
      amount,
      currency: currency.toUpperCase(),
      type: "withdrawal",
      status: "completed",
      paymentMethod: "mock",
      description: description || `Withdrawal of ${currency.toUpperCase()} ${amount}`,
      processedAt: new Date(),
    });

    res.status(201).json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/payments/transfer
// @desc    Transfer money to another user (investment)
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const transferMoney = async (req, res) => {
  try {
    const { toUserId, amount, currency = "usd", description, meetingId } = req.body;

    if (!toUserId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Recipient and valid amount are required." });
    }

    if (toUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot transfer to yourself." });
    }

    // Check sender balance
    const balance = await getWalletBalance(req.user._id);
    if (balance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: $${balance.toFixed(2)}`,
      });
    }

    const transaction = await Transaction.create({
      from: req.user._id,
      to: toUserId,
      amount,
      currency: currency.toUpperCase(),
      type: "transfer",
      status: "completed",
      paymentMethod: "mock",
      description: description || `Transfer to user`,
      reference: description,
      meetingId: meetingId || null,
      processedAt: new Date(),
    });

    await transaction.populate(["from", "to"], "name email profilePic");

    res.status(201).json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/payments/history
// @desc    Get transaction history for logged-in user
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getTransactionHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const pageNum = Number(req.query.page) || 1;
    const limitNum = Number(req.query.limit) || 20;

    const filter = {
      $or: [{ from: req.user._id }, { to: req.user._id }],
    };

    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;

    const skip = (pageNum - 1) * limitNum;

    const transactions = await Transaction.find(filter)
      .populate("from", "name email profilePic")
      .populate("to", "name email profilePic")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Transaction.countDocuments(filter);

    let balance = 0;
    try {
      balance = await getWalletBalanceCal(req.user._id);
    } catch (e) {
      console.error("Balance error:", e);
    }

    return res.status(200).json({
      success: true,
      balance: Number(balance.toFixed(2)),
      count: transactions.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      transactions,
    });

  } catch (error) {
    console.error("getTransactionHistory error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error.",
    });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/payments/balance
// @desc    Get current wallet balance
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getWalletBalance = async (req, res) => {
  try {
    const balance = await getWalletBalanceCal(req.user._id);
    res.status(200).json({ success: true, balance: parseFloat(balance.toFixed(2)) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/payments/:id
// @desc    Get single transaction details
// @access  Private (participants only)
// ────────────────────────────────────────────────────────────────────
export const getTransactionDetails = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate("from", "name email profilePic")
      .populate("to", "name email profilePic");

    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found." });
    }

    const isParticipant =
      transaction.from?._id.toString() === req.user._id.toString() ||
      transaction.to?._id.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    res.status(200).json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};
// ── Helper: Calculate wallet balance ──────────────────────────────
async function getWalletBalanceCal(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Money IN
  const inbound = await Transaction.aggregate([
    { $match: { to: userObjectId, status: "completed" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  // Money OUT
  const outbound = await Transaction.aggregate([
    { $match: { from: userObjectId, status: "completed" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const totalIn = inbound[0]?.total || 0;
  const totalOut = outbound[0]?.total || 0;

  return totalIn - totalOut;
}
