import Message from "../models/Message.js";
import Notification from "../models/Notification.js";

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/messages/send
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

    // ✅ FIXED: Correct populate syntax
    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "name email profilePic avatarUrl role")
      .populate("receiverId", "name email profilePic avatarUrl role");

  

    res.status(201).json({ success: true, message: populatedMessage });
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
    const userId = req.user._id;
    // Get all messages involving this user
    const allMessages = await Message.find({
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ],
    })
      .populate("senderId", "name email profilePic avatarUrl role isOnline isActive")
      .populate("receiverId", "name email profilePic avatarUrl role isOnline isActive")
      .sort({ createdAt: -1 });

    // ✅ FIXED: Filter out messages where populate failed
    const validMessages = allMessages.filter(
      (msg) => msg.senderId && msg.receiverId
    );

    // Build unique conversations (one entry per partner)
    const conversationMap = new Map();

    validMessages.forEach((msg) => {
      const isSender = msg.senderId._id.toString() === userId.toString();
      const partner = isSender ? msg.receiverId : msg.senderId;

      // ✅ FIXED: Skip if partner is null/undefined
      if (!partner || !partner._id) {
        return;
      }

      const partnerId = partner._id.toString();

      if (!conversationMap.has(partnerId)) {
        // ✅ FIXED: Build consistent conversation object
        const sortedIds = [userId.toString(), partnerId].sort();
        
        conversationMap.set(partnerId, {
          id: `conv-${sortedIds[0]}-${sortedIds[1]}`,
          partner: {
            _id: partner._id,
            name: partner.name || "Unknown",
            email: partner.email || "",
            avatarUrl: partner.avatarUrl || partner.profilePic || "",
            profilePic: partner.profilePic || partner.avatarUrl || "",
            role: partner.role || "",
            isOnline: partner.isOnline || partner.isActive || false,
          },
          lastMessage: {
            _id: msg._id,
            content: msg.content,
            senderId: msg.senderId._id.toString(),
            isRead: msg.isRead || false,
            createdAt: msg.createdAt,
            timestamp: msg.createdAt,
          },
          updatedAt: msg.createdAt,
          unreadCount: 0,
        });
      }
    });

    // ✅ FIXED: Count unread with try-catch per conversation
    const conversations = [];
    
    for (const conv of conversationMap.values()) {
      try {
        const unreadCount = await Message.countDocuments({
          senderId: conv.partner._id,
          receiverId: userId,
          isRead: false,
        });
        
        conversations.push({ ...conv, unreadCount });
      } catch (countError) {
        console.error("Error counting unread:", countError);
        conversations.push({ ...conv, unreadCount: 0 });
      }
    }

    res.status(200).json({
      success: true,
      count: conversations.length,
      conversations,
    });
  } catch (error) {
    // ✅ FIXED: Log the FULL error
    console.error("getConversations error:", error.message);
    console.error("Stack:", error.stack);
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
    const currentUserId = req.user._id;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: userId },
        { senderId: userId, receiverId: currentUserId },
      ],
    })
      .populate("senderId", "name email profilePic avatarUrl role")
      .populate("receiverId", "name email profilePic avatarUrl role")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Message.countDocuments({
      $or: [
        { senderId: currentUserId, receiverId: userId },
        { senderId: userId, receiverId: currentUserId },
      ],
    });

    // Mark all received messages as read
    await Message.updateMany(
      { senderId: userId, receiverId: currentUserId, isRead: false },
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
    console.error("getMessages error:", error.message);
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
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    if (message.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    res.status(200).json({ success: true, message });
  } catch (error) {
    console.error("markMessageAsRead error:", error.message);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/messages/unread-count
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
    console.error("getUnreadCount error:", error.message);
    res.status(500).json({ success: false, message: "Server error." });
  }
};