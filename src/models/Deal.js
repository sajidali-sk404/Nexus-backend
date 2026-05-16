import mongoose from "mongoose";

const DealSchema = new mongoose.Schema(
  {
    // ── Parties ───────────────────────────────────────────────────
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    entrepreneurId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Startup Info (denormalized for deal card display) ─────────
    startupName: { type: String, required: true },
    industry: { type: String, default: "" },

    // ── Deal Terms ────────────────────────────────────────────────
    amount: {
      type: Number,
      required: [true, "Investment amount is required"],
    },
    currency: { type: String, default: "USD" },
    equity: {
      type: Number, // percentage e.g. 15 for 15%
      required: [true, "Equity percentage is required"],
      min: 0,
      max: 100,
    },

    // ── Stage & Status ────────────────────────────────────────────
    stage: {
      type: String,
      enum: ["pre-seed", "seed", "series-a", "series-b", "series-c"],
      required: true,
    },
    status: {
      type: String,
      enum: ["negotiation", "due-diligence", "term-sheet", "closed", "passed"],
      default: "negotiation",
    },

    // ── Notes & Activity ──────────────────────────────────────────
    notes: { type: String, default: "" },
    lastActivity: { type: Date, default: Date.now },

    // ── Linked Resources ─────────────────────────────────────────
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
    documents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
    }],
    collaborationRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CollaborationRequest",
      default: null,
    },
  },
  { timestamps: true }
);

// Index for investor dashboard queries
DealSchema.index({ investorId: 1, status: 1, createdAt: -1 });
DealSchema.index({ entrepreneurId: 1, status: 1 });

export default  mongoose.model("Deal", DealSchema);