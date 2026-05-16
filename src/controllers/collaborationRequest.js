import express from "express";
import CollaborationRequest from "../models/CollaborationRequest.js";
import Notification from "../models/Notification.js";


// ────────────────────────────────────────────────────────────────────
// @route   POST /api/collaborations
// @desc    Send a collaboration request (investor only)
// @access  Private — Investor
// ────────────────────────────────────────────────────────────────────
export const sendCollaborationRequest = async (req, res) => {
  try {
    const { entrepreneurId, message } = req.body;

    if (!entrepreneurId || !message) {
      return res.status(400).json({
        success: false,
        message: "entrepreneurId and message are required.",
      });
    }

    // Check for duplicate request
    const existing = await CollaborationRequest.findOne({
      investorId: req.user._id,
      entrepreneurId,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You already sent a request to this entrepreneur.",
      });
    }

    const request = await CollaborationRequest.create({
      investorId: req.user._id,
      entrepreneurId,
      message,
    });

    await request.populate(["investorId", "entrepreneurId"], "name email profilePic role");

    // Notify the entrepreneur
    await Notification.create({
      userId: entrepreneurId,
      fromUserId: req.user._id,
      type: "investment",
      content: `${req.user.name} sent you a collaboration request`,
      refId: request._id,
      refModel: "CollaborationRequest",
    });

    res.status(201).json({ success: true, request });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate request — already sent to this entrepreneur.",
      });
    }
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/collaborations/received
// @desc    Get all requests received (entrepreneur only)
// @access  Private — Entrepreneur
// ────────────────────────────────────────────────────────────────────
export const getReceivedRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { entrepreneurId: req.user._id };
    if (status) filter.status = status;

    const requests = await CollaborationRequest.find(filter)
      .populate("investorId", "name email profilePic role bio investmentFocus")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: requests.length, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/collaborations/sent
// @desc    Get all requests sent (investor only)
// @access  Private — Investor
// ────────────────────────────────────────────────────────────────────
export const getSentRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { investorId: req.user._id };
    if (status) filter.status = status;

    const requests = await CollaborationRequest.find(filter)
      .populate("entrepreneurId", "name email profilePic role bio startupName industry")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: requests.length, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   PUT /api/collaborations/:id/respond
// @desc    Accept or reject a request (entrepreneur only)
// @access  Private — Entrepreneur
// ────────────────────────────────────────────────────────────────────
export const respondToRequest = async (req, res) => {
  try {
    const { action } = req.body; // "accepted" or "rejected"

    if (!["accepted", "rejected"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'accepted' or 'rejected'.",
      });
    }

    const request = await CollaborationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found." });
    }

    // Only the target entrepreneur can respond
    if (request.entrepreneurId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status}.`,
      });
    }

    request.status = action;
    await request.save();
    await request.populate(["investorId", "entrepreneurId"], "name email profilePic role");

    // Notify the investor of the response
    await Notification.create({
      userId: request.investorId._id,
      fromUserId: req.user._id,
      type: "connection",
      content: `${req.user.name} ${action} your collaboration request`,
      refId: request._id,
      refModel: "CollaborationRequest",
    });

    res.status(200).json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   DELETE /api/collaborations/:id
// @desc    Cancel/withdraw a request (investor only, pending only)
// @access  Private — Investor
// ────────────────────────────────────────────────────────────────────
export const cancelRequest = async (req, res) => {
  try {
    const request = await CollaborationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found." });
    }

    if (request.investorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Can only withdraw pending requests.",
      });
    }

    await request.deleteOne();
    res.status(200).json({ success: true, message: "Request withdrawn." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

