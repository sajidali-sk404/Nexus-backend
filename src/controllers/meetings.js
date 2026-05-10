  import express from "express";
  import { v4 as uuidv4 } from "uuid";
  import Meeting from"../models/Meeting.js";


  // ────────────────────────────────────────────────────────────────────
  // @route   POST /api/meetings
  // @desc    Schedule a new meeting
  // @access  Private
  // ────────────────────────────────────────────────────────────────────
  export const scheduleMeeting = async (req, res) => {
    try {
      const { title, attendeeId, date, startTime, endTime, type, description, agenda } = req.body;

      if (!title || !attendeeId || !date || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: "Title, attendee, date, startTime and endTime are required.",
        });
      }

      // Prevent scheduling with yourself
      if (attendeeId === req.user._id.toString()) {
        return res.status(400).json({ success: false, message: "Cannot schedule a meeting with yourself." });
      }

      // ── Conflict detection for BOTH organizer and attendee ─────────
      const organizerConflict = await Meeting.hasConflict(req.user._id, date, startTime, endTime);
      if (organizerConflict) {
        return res.status(409).json({
          success: false,
          message: "You already have a meeting during this time slot.",
        });
      }

      const attendeeConflict = await Meeting.hasConflict(attendeeId, date, startTime, endTime);
      if (attendeeConflict) {
        return res.status(409).json({
          success: false,
          message: "The other person is already booked during this time slot.",
        });
      }

      // Calculate duration in minutes
      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);
      const duration = (endH * 60 + endM) - (startH * 60 + startM);

      if (duration <= 0) {
        return res.status(400).json({ success: false, message: "End time must be after start time." });
      }

      const meeting = await Meeting.create({
        title,
        organizer: req.user._id,
        attendee: attendeeId,
        date: new Date(date),
        startTime,
        endTime,
        duration,
        type: type || "video",
        description,
        agenda: agenda || [],
        roomId: type === "video" || !type ? uuidv4() : undefined,
      });

      await meeting.populate(["organizer", "attendee"], "name email profilePic role");

      res.status(201).json({ success: true, meeting });
    } catch (error) {
      console.error("Create meeting error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // @route   GET /api/meetings
  // @desc    Get all meetings for logged-in user
  // @access  Private
  // ────────────────────────────────────────────────────────────────────
  export const getMeetings = async (req, res) => {
    try {
      const { status, from, to } = req.query;

      const filter = {
        $or: [{ organizer: req.user._id }, { attendee: req.user._id }],
      };

      if (status) filter.status = status;
      if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = new Date(from);
        if (to) filter.date.$lte = new Date(to);
      }

      const meetings = await Meeting.find(filter)
        .populate("organizer", "name email profilePic role")
        .populate("attendee", "name email profilePic role")
        .sort({ date: 1, startTime: 1 });

      res.status(200).json({ success: true, count: meetings.length, meetings });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // @route   GET /api/meetings/:id
  // @desc    Get single meeting
  // @access  Private (participants only)
  // ────────────────────────────────────────────────────────────────────
  export const getMeeting = async (req, res) => {
    try {
      const meeting = await Meeting.findById(req.params.id)
        .populate("organizer", "name email profilePic role")
        .populate("attendee", "name email profilePic role");

      if (!meeting) {
        return res.status(404).json({ success: false, message: "Meeting not found." });
      }

      // Only participants can view
      const isParticipant =
        meeting.organizer._id.toString() === req.user._id.toString() ||
        meeting.attendee._id.toString() === req.user._id.toString();

      if (!isParticipant) {
        return res.status(403).json({ success: false, message: "Access denied." });
      }

      res.status(200).json({ success: true, meeting });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // @route   PUT /api/meetings/:id/respond
  // @desc    Accept or reject a meeting (attendee only)
  // @access  Private
  // ────────────────────────────────────────────────────────────────────
  export const respondToMeeting = async (req, res) => {
    try {
      const { action, rejectionReason } = req.body; // action: 'accepted' | 'rejected'

      if (!["accepted", "rejected"].includes(action)) {
        return res.status(400).json({ success: false, message: "Action must be 'accepted' or 'rejected'." });
      }

      const meeting = await Meeting.findById(req.params.id);
      if (!meeting) {
        return res.status(404).json({ success: false, message: "Meeting not found." });
      }

      // Only the attendee can respond
      if (meeting.attendee.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: "Only the invitee can respond to a meeting." });
      }

      if (meeting.status !== "pending") {
        return res.status(400).json({ success: false, message: `Meeting is already ${meeting.status}.` });
      }

      meeting.status = action;
      if (action === "rejected" && rejectionReason) {
        meeting.rejectionReason = rejectionReason;
      }

      await meeting.save();
      await meeting.populate(["organizer", "attendee"], "name email profilePic");

      res.status(200).json({ success: true, meeting });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // @route   PUT /api/meetings/:id/cancel
  // @desc    Cancel a meeting (organizer only)
  // @access  Private
  // ────────────────────────────────────────────────────────────────────
  export const cancelMeeting = async (req, res) => {
    try {
      const meeting = await Meeting.findById(req.params.id);
      if (!meeting) {
        return res.status(404).json({ success: false, message: "Meeting not found." });
      }

      if (meeting.organizer.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: "Only the organizer can cancel." });
      }

      if (["cancelled", "completed"].includes(meeting.status)) {
        return res.status(400).json({ success: false, message: `Cannot cancel a ${meeting.status} meeting.` });
      }

      meeting.status = "cancelled";
      await meeting.save();

      res.status(200).json({ success: true, message: "Meeting cancelled.", meeting });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // @route   PUT /api/meetings/:id/notes
  // @desc    Add post-meeting notes
  // @access  Private (participants only)
  // ────────────────────────────────────────────────────────────────────
  export const addMeetingNotes = async (req, res) => {
    try {
      const { notes } = req.body;
      const meeting = await Meeting.findById(req.params.id);

      if (!meeting) return res.status(404).json({ success: false, message: "Meeting not found." });

      const isParticipant =
        meeting.organizer.toString() === req.user._id.toString() ||
        meeting.attendee.toString() === req.user._id.toString();

      if (!isParticipant) return res.status(403).json({ success: false, message: "Access denied." });

      meeting.notes = notes;
      await meeting.save();

      res.status(200).json({ success: true, meeting });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  };


