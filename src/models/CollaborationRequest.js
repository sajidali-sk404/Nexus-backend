import mongoose from "mongoose";

const CollaborationRequestSchema = new mongoose.Schema(
  {
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
    message: {
      type: String,
      required: [true, "A message is required with your request"],
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Prevent duplicate requests from same investor to same entrepreneur
CollaborationRequestSchema.index(
  { investorId: 1, entrepreneurId: 1 },
  { unique: true }
);

export default mongoose.model("CollaborationRequest", CollaborationRequestSchema);