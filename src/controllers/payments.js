import Transaction from "../models/Transaction.js";
import mongoose from "mongoose";
import Stripe from "stripe";
import Notification from "../models/Notification.js";

// ✅ Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── Helper: Calculate wallet balance ──────────────────────────────
async function calculateBalance(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const inbound = await Transaction.aggregate([
    { $match: { to: userObjectId, status: "completed" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const outbound = await Transaction.aggregate([
    { $match: { from: userObjectId, status: "completed" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return (inbound[0]?.total || 0) - (outbound[0]?.total || 0);
}

// ────────────────────────────────────────────────────────────────────
// POST /api/payments/create-payment-intent
// Create Stripe Payment Intent for deposit
// ────────────────────────────────────────────────────────────────────
export const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = "pkr" } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required.",
      });
    }

    // ✅ Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: currency.toLowerCase(),
      metadata: {
        userId: req.user._id.toString(),
        userName: req.user.name,
        type: "deposit",
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // ✅ Save pending transaction
    const transaction = await Transaction.create({
      to: req.user._id,
      amount,
      currency: currency.toUpperCase(),
      type: "deposit",
      status: "pending",
      stripePaymentIntentId: paymentIntent.id,
      paymentMethod: "card",
      description: `Deposit of ${currency.toUpperCase()} ${amount}`,
    });

    console.log("Payment Intent created:", paymentIntent.id);

    res.status(201).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      transactionId: transaction._id,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Create Payment Intent error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ────────────────────────────────────────────────────────────────────
// POST /api/payments/confirm-payment
// Confirm payment after Stripe processes it
// ────────────────────────────────────────────────────────────────────
export const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "Payment Intent ID is required.",
      });
    }

    // ✅ Verify with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log("Payment status:", paymentIntent.status);

    if (paymentIntent.status === "succeeded") {
      // ✅ Update transaction to completed
      const transaction = await Transaction.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntentId },
        {
          status: "completed",
          processedAt: new Date(),
        },
        { new: true }
      );

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found.",
        });
      }

      const balance = await calculateBalance(req.user._id);

      res.status(200).json({
        success: true,
        message: "Payment confirmed!",
        transaction,
        balance: Number(balance.toFixed(2)),
      });
    } else {
      // Payment failed or requires action
      await Transaction.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntentId },
        { status: "failed", failureReason: `Payment status: ${paymentIntent.status}` }
      );

      res.status(400).json({
        success: false,
        message: `Payment not completed. Status: ${paymentIntent.status}`,
      });
    }
  } catch (error) {
    console.error("Confirm payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ────────────────────────────────────────────────────────────────────
// POST /api/payments/webhook
// Stripe Webhook (optional but recommended)
// ────────────────────────────────────────────────────────────────────
export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle events
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;
      console.log("✅ Payment succeeded:", paymentIntent.id);

      await Transaction.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntent.id },
        { status: "completed", processedAt: new Date() }
      );
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      console.log("❌ Payment failed:", paymentIntent.id);

      await Transaction.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntent.id },
        {
          status: "failed",
          failureReason: paymentIntent.last_payment_error?.message || "Payment failed",
        }
      );
      break;
    }

    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  res.json({ received: true });
};

// ────────────────────────────────────────────────────────────────────
// POST /api/payments/deposit (Mock - keep for testing)
// ────────────────────────────────────────────────────────────────────
export const depositMoney = async (req, res) => {
  try {
    const { amount, currency = "pkr", paymentMethod = "mock" } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required.",
      });
    }

    const transaction = await Transaction.create({
      to: req.user._id,
      amount,
      currency: currency.toUpperCase(),
      type: "deposit",
      status: "completed",
      paymentMethod: paymentMethod || "mock",
      description: `Deposit of ${currency.toUpperCase()} ${amount}`,
      processedAt: new Date(),
    });

    const balance = await calculateBalance(req.user._id);

    res.status(201).json({
      success: true,
      transaction,
      balance: Number(balance.toFixed(2)),
    });
  } catch (error) {
    console.error("Deposit error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ────────────────────────────────────────────────────────────────────
// POST /api/payments/withdraw
// ────────────────────────────────────────────────────────────────────
export const withdrawMoney = async (req, res) => {
  try {
    const { amount, currency = "pkr", description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required.",
      });
    }

    const balance = await calculateBalance(req.user._id);

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

    const newBalance = await calculateBalance(req.user._id);

    res.status(201).json({
      success: true,
      transaction,
      balance: Number(newBalance.toFixed(2)),
    });
  } catch (error) {
    console.error("Withdraw error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ────────────────────────────────────────────────────────────────────
// POST /api/payments/transfer
// ────────────────────────────────────────────────────────────────────
export const transferMoney = async (req, res) => {
  try {
    const { toUserId, amount, currency = "pkr", description } = req.body;

    if (!toUserId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Recipient and valid amount are required.",
      });
    }

    if (toUserId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot transfer to yourself.",
      });
    }

    const balance = await calculateBalance(req.user._id);

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
      description: description || "Transfer to user",
      processedAt: new Date(),
    });
    
    await Notification.create({
      userId: toUserId,
      fromUserId: req.user._id,
      type: "payment",
      content: `${req.user.name} sent you $${amount}`,
      refId: transaction._id,
      refModel: "Transaction",
    });

    await transaction.populate("from", "name email profilePic");
    await transaction.populate("to", "name email profilePic");

    res.status(201).json({ success: true, transaction });
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Keep existing getTransactionHistory, getWalletBalance, getTransactionDetails...
export const getTransactionHistory = async (req, res) => {
  try {
    const pageNum = Number(req.query.page) || 1;
    const limitNum = Number(req.query.limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      $or: [{ from: req.user._id }, { to: req.user._id }],
    };

    if (req.query.type) filter.type = req.query.type;

    const transactions = await Transaction.find(filter)
      .populate("from", "name email profilePic avatarUrl")
      .populate("to", "name email profilePic avatarUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Transaction.countDocuments(filter);
    const balance = await calculateBalance(req.user._id);

    res.status(200).json({
      success: true,
      balance: Number(balance.toFixed(2)),
      count: transactions.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      transactions,
    });
  } catch (error) {
    console.error("History error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getWalletBalance = async (req, res) => {
  try {
    const balance = await calculateBalance(req.user._id);
    res.status(200).json({ success: true, balance: parseFloat(balance.toFixed(2)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTransactionDetails = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate("from", "name email profilePic avatarUrl")
      .populate("to", "name email profilePic avatarUrl");

    if (!transaction) {
      return res.status(404).json({ success: false, message: "Not found." });
    }

    res.status(200).json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};