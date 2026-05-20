import express from 'express';
import { scheduleMeeting, getMeeting, respondToMeeting, cancelMeeting, addMeetingNotes, getMeetings } from '../controllers/meetings.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/meetings
// @desc    Schedule a new meeting
// @access  Private
// ────────────────────────────────────────────────────────────────────
router.post("/", protect, scheduleMeeting);
router.get("/", protect, getMeetings);
router.get("/:id", protect, getMeeting);
router.put("/:id/respond", protect, respondToMeeting);
router.put("/:id/cancel", protect, cancelMeeting);
router.put("/:id/notes", protect, addMeetingNotes);

export default router;