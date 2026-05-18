import Deal from "../models/Deal.js";
import Notification from "../models/Notification.js";

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/deals
// @desc    Create a new deal
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const createDeal = async (req, res) => {
  try {
    const {
      title,
      description,
      investorId,
      entrepreneurId,
      amount,
      currency,
      equity,
      dealType,
      stage,
      terms,
      startupName,
      industry,
      valuation,
      closingDate,
      status,
    } = req.body;

    if (!title || !amount) {
      return res.status(400).json({
        success: false,
        message: "Title and amount are required.",
      });
    }

    // Determine investor and entrepreneur based on role
    const finalInvestorId =
      req.user.role === "investor" ? req.user._id : investorId;
    const finalEntrepreneurId =
      req.user.role === "entrepreneur" ? req.user._id : entrepreneurId;

    if (!finalInvestorId || !finalEntrepreneurId) {
      return res.status(400).json({
        success: false,
        message: "Both investor and entrepreneur are required.",
      });
    }

    const deal = await Deal.create({
      title,
      description,
      investorId: finalInvestorId,
      entrepreneurId: finalEntrepreneurId,
      amount,
      currency: currency || "USD",
      equity: equity || 0,
      dealType: dealType || "equity",
      stage: stage || "seed",
      terms,
      startupName,
      industry,
      valuation,
      closingDate: closingDate || null,
      status: status || "proposed",
      createdBy: req.user._id,
    });

    const populatedDeal = await Deal.findById(deal._id)
      .populate("investorId", "name email profilePic avatarUrl role")
      .populate("entrepreneurId", "name email profilePic avatarUrl role startupName industry");

    // Notify the other party
    const recipientId =
      req.user.role === "investor" ? finalEntrepreneurId : finalInvestorId;

    await Notification.create({
      userId: recipientId,
      fromUserId: req.user._id,
      type: "investment",
      content: `${req.user.name} created a new deal: "${title}"`,
      refId: deal._id,
      refModel: "Deal",
    });

    res.status(201).json({ success: true, deal: populatedDeal });
  } catch (error) {
    console.error("Create deal error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/deals
// @desc    Get all deals for logged-in user
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getDeals = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { investorId: req.user._id },
        { entrepreneurId: req.user._id },
        { createdBy: req.user._id },
      ],
    };

    if (status) filter.status = status;
    if (type) filter.dealType = type;

    const deals = await Deal.find(filter)
      .populate("investorId", "name email profilePic avatarUrl role")
      .populate("entrepreneurId", "name email profilePic avatarUrl role startupName industry")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Deal.countDocuments(filter);

    // Stats
    const stats = {
      total,
      proposed: await Deal.countDocuments({ ...filter, status: "proposed" }),
      negotiating: await Deal.countDocuments({ ...filter, status: "negotiating" }),
      accepted: await Deal.countDocuments({ ...filter, status: "accepted" }),
      completed: await Deal.countDocuments({ ...filter, status: "completed" }),
      totalValue: 0,
    };

    // Calculate total deal value
    const valueAgg = await Deal.aggregate([
      {
        $match: {
          $or: [
            { investorId: req.user._id },
            { entrepreneurId: req.user._id },
          ],
          status: { $in: ["accepted", "completed"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    stats.totalValue = valueAgg[0]?.total || 0;

    res.status(200).json({
      success: true,
      count: deals.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      stats,
      deals,
    });
  } catch (error) {
    console.error("Get deals error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/deals/:id
// @desc    Get single deal
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate("investorId", "name email profilePic avatarUrl role bio")
      .populate("entrepreneurId", "name email profilePic avatarUrl role startupName industry bio")
      .populate("createdBy", "name email")
      .populate("notes.userId", "name profilePic");

    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found." });
    }

    // Check access
    const isParticipant =
      deal.investorId._id.toString() === req.user._id.toString() ||
      deal.entrepreneurId._id.toString() === req.user._id.toString() ||
      deal.createdBy._id.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    res.status(200).json({ success: true, deal });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   PUT /api/deals/:id
// @desc    Update deal
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const updateDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found." });
    }

    const isParticipant =
      deal.investorId.toString() === req.user._id.toString() ||
      deal.entrepreneurId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    // Don't allow updating certain fields
    const forbidden = ["investorId", "entrepreneurId", "createdBy"];
    forbidden.forEach((field) => delete req.body[field]);

    const updatedDeal = await Deal.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate("investorId", "name email profilePic avatarUrl role")
      .populate("entrepreneurId", "name email profilePic avatarUrl role startupName");

    // Notify other party about update
    const recipientId =
      req.user._id.toString() === deal.investorId.toString()
        ? deal.entrepreneurId
        : deal.investorId;

    await Notification.create({
      userId: recipientId,
      fromUserId: req.user._id,
      type: "investment",
      content: `${req.user.name} updated the deal: "${updatedDeal.title}"`,
      refId: deal._id,
      refModel: "Deal",
    });

    res.status(200).json({ success: true, deal: updatedDeal });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   PUT /api/deals/:id/status
// @desc    Update deal status (accept, reject, complete, cancel)
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const updateDealStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["proposed", "negotiating", "accepted", "rejected", "completed", "cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found." });
    }

    const isParticipant =
      deal.investorId.toString() === req.user._id.toString() ||
      deal.entrepreneurId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    deal.status = status;
    await deal.save();

    await deal.populate("investorId", "name email profilePic avatarUrl role");
    await deal.populate("entrepreneurId", "name email profilePic avatarUrl role startupName");

    // Notify
    const recipientId =
      req.user._id.toString() === deal.investorId._id.toString()
        ? deal.entrepreneurId._id
        : deal.investorId._id;

    await Notification.create({
      userId: recipientId,
      fromUserId: req.user._id,
      type: "investment",
      content: `${req.user.name} ${status} the deal: "${deal.title}"`,
      refId: deal._id,
      refModel: "Deal",
    });

    res.status(200).json({ success: true, deal });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/deals/:id/notes
// @desc    Add note to deal
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const addDealNote = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: "Note content is required." });
    }

    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found." });
    }

    deal.notes.push({
      userId: req.user._id,
      content,
      createdAt: new Date(),
    });

    await deal.save();
    await deal.populate("notes.userId", "name profilePic");

    res.status(200).json({ success: true, deal });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   DELETE /api/deals/:id
// @desc    Delete deal (draft/cancelled only)
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const deleteDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found." });
    }

    if (deal.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    if (!["draft", "cancelled", "rejected"].includes(deal.status)) {
      return res.status(400).json({
        success: false,
        message: "Can only delete draft, cancelled, or rejected deals.",
      });
    }

    await deal.deleteOne();
    res.status(200).json({ success: true, message: "Deal deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};