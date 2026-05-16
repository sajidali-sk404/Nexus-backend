import express from "express";
import Notification from "../models/Notification.js";


// ────────────────────────────────────────────────────────────────────
// @route   GET /api/notifications
// @desc    Get all notifications for logged-in user
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id };
    if (unreadOnly === "true") filter.isRead = false;

    const notifications = await Notification.find(filter)
      .populate("fromUserId", "name email profilePic role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      unreadCount,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      notifications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   PUT /api/notifications/read-all
// @desc    Mark ALL notifications as read
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   DELETE /api/notifications/:id
// @desc    Delete a single notification
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    await notification.deleteOne();
    res.status(200).json({ success: true, message: "Notification deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   DELETE /api/notifications
// @desc    Clear ALL notifications for logged-in user
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user._id });
    res.status(200).json({ success: true, message: "All notifications cleared." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

