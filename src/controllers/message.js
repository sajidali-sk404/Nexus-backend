import express from "express";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";



// ────────────────────────────────────────────────────────────────────
// @route   POST /api/messages
// @desc    Send a new message
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({
        success: false,
        message: "receiverId and content are required.",
      });
    }

    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot send a message to yourself.",
      });
    }

    const message = await Message.create({
      senderId: req.user._id,
      receiverId,
      content,
    });

    await message.populate(["senderId", "receiverId"], "name email profilePic role");

    // Create notification for receiver
    await Notification.create({
      userId: receiverId,
      fromUserId: req.user._id,
      type: "message",
      content: `${req.user.name} sent you a message`,
      refId: message._id,
      refModel: "Message",
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/messages/conversations
// @desc    Get all conversations for logged-in user
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getConversations = async (req, res) => {
  try {
    // Get all messages involving this user
    const allMessages = await Message.find({
      $or: [{ senderId: req.user._id }, { receiverId: req.user._id }],
    })
      .populate("senderId", "name email profilePic role isActive")
      .populate("receiverId", "name email profilePic role isActive")
      .sort({ createdAt: -1 });

    // Build unique conversations (one entry per partner)
    const conversationMap = new Map();

    allMessages.forEach((msg) => {
      const partner =
        msg.senderId._id.toString() === req.user._id.toString()
          ? msg.receiverId
          : msg.senderId;

      const partnerId = partner._id.toString();

      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          id: `conv-${req.user._id}-${partnerId}`,
          partner,
          lastMessage: msg,
          updatedAt: msg.createdAt,
        });
      }
    });

    // Count unread per conversation
    const conversations = await Promise.all(
      Array.from(conversationMap.values()).map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          senderId: conv.partner._id,
          receiverId: req.user._id,
          isRead: false,
        });
        return { ...conv, unreadCount };
      })
    );

    res.status(200).json({ success: true, count: conversations.length, conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/messages/:userId
// @desc    Get all messages between logged-in user and another user
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, receiverId: userId },
        { senderId: userId, receiverId: req.user._id },
      ],
    })
      .populate("senderId", "name email profilePic role")
      .populate("receiverId", "name email profilePic role")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Message.countDocuments({
      $or: [
        { senderId: req.user._id, receiverId: userId },
        { senderId: userId, receiverId: req.user._id },
      ],
    });

    // Mark all received messages as read
    await Message.updateMany(
      { senderId: userId, receiverId: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      messages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   PUT /api/messages/:messageId/read
// @desc    Mark a single message as read
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const markMessageAsRead = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found." });
    }

    if (message.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    res.status(200).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/messages/unread/count
// @desc    Get total unread message count for logged-in user
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiverId: req.user._id,
      isRead: false,
    });

    res.status(200).json({ success: true, unreadCount: count });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

