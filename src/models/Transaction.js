import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    // ── Parties ────────────────────────────────────────────────────
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null for deposits (external → user)
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null for withdrawals (user → external)
    },

    // ── Amount ─────────────────────────────────────────────────────
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    currency: {
      type: String,
      default: "USD",
    },

    // ── Type ───────────────────────────────────────────────────────
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "transfer", "investment", "refund"],
      required: true,
    },

    // ── Status ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled", "refunded"],
      default: "pending",
    },

    // ── Payment Gateway (Stripe) ───────────────────────────────────
    stripePaymentIntentId: { type: String, default: null },
    stripeChargeId: { type: String, default: null },
    paymentMethod: {
      type: String,
      enum: ["card", "bank", "wallet", "mock"],
      default: "mock",
    },

    // ── Reference ─────────────────────────────────────────────────
    description: { type: String, default: "" },
    reference: { type: String, default: "" }, // e.g. "Investment in TechStartup"
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },

    // ── Metadata ───────────────────────────────────────────────────
    failureReason: { type: String, default: null },
    processedAt: { type: Date, default: null },
    fee: { type: Number, default: 0 },
    netAmount: { type: Number }, // amount - fee
  },
  { timestamps: true }
);

// ── Auto-calculate netAmount before saving ─────────────────────────
TransactionSchema.pre("save", function () {
  this.netAmount = this.amount - (this.fee || 0);
  if (this.status === "completed" && !this.processedAt) {
    this.processedAt = new Date();
  }
});

// ── Index for dashboard queries ────────────────────────────────────
TransactionSchema.index({ from: 1, createdAt: -1 });
TransactionSchema.index({ to: 1, createdAt: -1 });
TransactionSchema.index({ stripePaymentIntentId: 1 });

export default mongoose.model("Transaction", TransactionSchema);
