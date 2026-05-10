import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema(
  {
    // ── File Info ──────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Document title is required"],
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true, // local path or S3 URL
    },
    fileType: {
      type: String, // "application/pdf", "image/png", etc.
      required: true,
    },
    fileSize: {
      type: Number, // in bytes
      required: true,
    },

    // ── Ownership ──────────────────────────────────────────────────
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedWith: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        permission: {
          type: String,
          enum: ["view", "sign", "edit"],
          default: "view",
        },
        sharedAt: { type: Date, default: Date.now },
      },
    ],

    // ── Categorization ─────────────────────────────────────────────
    category: {
      type: String,
      enum: ["pitch-deck", "nda", "term-sheet", "agreement", "report", "other"],
      default: "other",
    },
    tags: [{ type: String }],
    description: { type: String, default: "" },

    // ── Status ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["draft", "pending-signature", "signed", "archived"],
      default: "draft",
    },

    // ── Versioning ─────────────────────────────────────────────────
    version: { type: Number, default: 1 },
    previousVersions: [
      {
        version: Number,
        fileUrl: String,
        uploadedAt: Date,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    // ── E-Signature ────────────────────────────────────────────────
    signatures: [
      {
        signedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        signatureImage: { type: String }, // base64 image string
        signedAt: { type: Date, default: Date.now },
        ipAddress: { type: String },
      },
    ],
    requiresSignature: { type: Boolean, default: false },
    allSignaturesComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Index for fast lookups ─────────────────────────────────────────
DocumentSchema.index({ uploadedBy: 1, createdAt: -1 });
DocumentSchema.index({ "sharedWith.user": 1 });

export default mongoose.model("Document", DocumentSchema);
