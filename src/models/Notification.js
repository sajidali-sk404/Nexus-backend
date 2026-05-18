import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // who receives this notification
    },
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // who triggered it
    },
    type: {
      type: String,
      enum: ["message", "connection", "investment", "meeting", "document", "payment"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    // Link to the related resource
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // e.g. meetingId, docId, requestId
    },
    refModel: {
      type: String,
      enum: ["Message", "CollaborationRequest", "Deal", "Meeting", "Document", "Transaction", null],
      default: null,
    },
  },
  { timestamps: true }
);

// Index for fast unread count queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default mongoose.model("Notification", NotificationSchema);