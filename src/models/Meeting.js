import mongoose from "mongoose";

const MeetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Meeting title is required"],
      trim: true,
    },

    // ── Participants ───────────────────────────────────────────────
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    attendee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Schedule ───────────────────────────────────────────────────
    date: {
      type: Date,
      required: [true, "Meeting date is required"],
    },
    startTime: {
      type: String, // "14:00"
      required: [true, "Start time is required"],
    },
    endTime: {
      type: String, // "15:00"
      required: [true, "End time is required"],
    },
    duration: {
      type: Number, // in minutes
      required: true,
    },
    timezone: {
      type: String,
      default: "UTC",
    },

    // ── Status ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled", "completed"],
      default: "pending",
    },

    // ── Meeting Type ───────────────────────────────────────────────
    type: {
      type: String,
      enum: ["video", "in-person", "phone"],
      default: "video",
    },

    // ── Video Call ─────────────────────────────────────────────────
    roomId: {
      type: String,
      unique: true,
      sparse: true, // only for video meetings
    },

    // ── Details ────────────────────────────────────────────────────
    description: { type: String, default: "" },
    agenda: [{ type: String }],
    notes: { type: String, default: "" }, // post-meeting notes

    // ── Rejection Reason ───────────────────────────────────────────
    rejectionReason: { type: String, default: "" },

    // ── Reminders ─────────────────────────────────────────────────
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Index for fast conflict detection queries ──────────────────────
MeetingSchema.index({ organizer: 1, date: 1, status: 1 });
MeetingSchema.index({ attendee: 1, date: 1, status: 1 });

// ── Static: Check for scheduling conflicts ─────────────────────────
MeetingSchema.statics.hasConflict = async function (userId, date, startTime, endTime, excludeId = null) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const query = {
    $or: [{ organizer: userId }, { attendee: userId }],
    date: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ["pending", "accepted"] },
    // Time overlap: existing.start < new.end AND existing.end > new.start
    $and: [
      { startTime: { $lt: endTime } },
      { endTime: { $gt: startTime } },
    ],
  };

  if (excludeId) query._id = { $ne: excludeId };

  const conflict = await this.findOne(query);
  return !!conflict;
};

export default mongoose.model("Meeting", MeetingSchema);
