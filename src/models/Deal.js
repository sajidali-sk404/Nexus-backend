import mongoose from "mongoose";

const dealSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Deal title is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
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
    amount: {
      type: Number,
      required: [true, "Deal amount is required"],
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },
    equity: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    dealType: {
      type: String,
      enum: ["equity", "debt", "convertible-note", "safe", "grant", "other"],
      default: "equity",
    },
    status: {
      type: String,
      enum: ["draft", "proposed", "negotiating", "accepted", "rejected", "completed", "cancelled"],
      default: "draft",
    },
    stage: {
      type: String,
      enum: ["pre-seed", "seed", "series-a", "series-b", "series-c", "other"],
      default: "seed",
    },
    terms: {
      type: String,
      default: "",
    },
    startupName: {
      type: String,
      default: "",
    },
    industry: {
      type: String,
      default: "",
    },
    valuation: {
      type: Number,
      default: 0,
    },
    closingDate: {
      type: Date,
      default: null,
    },
    documents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
      },
    ],
    notes: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        content: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
dealSchema.index({ investorId: 1, status: 1 });
dealSchema.index({ entrepreneurId: 1, status: 1 });
dealSchema.index({ createdBy: 1 });

export default mongoose.model("Deal", dealSchema);