import express from "express";
import Deal from "../models/Deal.js";


// ────────────────────────────────────────────────────────────────────
// @route   POST /api/deals
// @desc    Create a new deal (investor only)
// @access  Private — Investor
// ────────────────────────────────────────────────────────────────────
export const createDeal = async (req, res) => {
  try {
    const {
      entrepreneurId, startupName, industry,
      amount, equity, stage, notes,
      meetingId, collaborationRequestId,
    } = req.body;

    if (!entrepreneurId || !startupName || !amount || !equity || !stage) {
      return res.status(400).json({
        success: false,
        message: "entrepreneurId, startupName, amount, equity and stage are required.",
      });
    }

    const deal = await Deal.create({
      investorId: req.user._id,
      entrepreneurId,
      startupName,
      industry,
      amount,
      equity,
      stage,
      notes,
      meetingId: meetingId || null,
      collaborationRequestId: collaborationRequestId || null,
    });

    await deal.populate(["investorId", "entrepreneurId"], "name email profilePic");

    res.status(201).json({ success: true, deal });
  } catch (error) {
    console.error("Create deal error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/deals
// @desc    Get all deals for logged-in investor + stats
// @access  Private — Investor
// ────────────────────────────────────────────────────────────────────
export const getDeals = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const filter = { investorId: req.user._id };

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { startupName: new RegExp(search, "i") },
        { industry: new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;

    const deals = await Deal.find(filter)
      .populate("entrepreneurId", "name email profilePic startupName industry")
      .populate("investorId", "name email profilePic")
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Deal.countDocuments(filter);

    // ── Dashboard stats (matches DealsPage stat cards) ─────────────
    const allDeals = await Deal.find({ investorId: req.user._id });

    const stats = {
      totalInvestment: allDeals
        .filter((d) => d.status === "closed")
        .reduce((sum, d) => sum + d.amount, 0),
      activeDeals: allDeals.filter((d) =>
        ["negotiation", "due-diligence", "term-sheet"].includes(d.status)
      ).length,
      portfolioCompanies: allDeals.filter((d) => d.status === "closed").length,
      closedThisMonth: allDeals.filter((d) => {
        const now = new Date();
        const dealDate = new Date(d.updatedAt);
        return (
          d.status === "closed" &&
          dealDate.getMonth() === now.getMonth() &&
          dealDate.getFullYear() === now.getFullYear()
        );
      }).length,
    };

    res.status(200).json({
      success: true,
      stats,
      count: deals.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      deals,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/deals/my-deals
// @desc    Get deals for entrepreneur (deals involving their startup)
// @access  Private — Entrepreneur
// ────────────────────────────────────────────────────────────────────
export const getMyDeals = async (req, res) => {
  try {
    const deals = await Deal.find({ entrepreneurId: req.user._id })
      .populate("investorId", "name email profilePic investmentFocus")
      .sort({ lastActivity: -1 });

    res.status(200).json({ success: true, count: deals.length, deals });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/deals/:id
// @desc    Get single deal details
// @access  Private (investor or entrepreneur involved)
// ────────────────────────────────────────────────────────────────────
export const getDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate("investorId", "name email profilePic")
      .populate("entrepreneurId", "name email profilePic startupName")
      .populate("documents")
      .populate("meetingId");

    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found." });
    }

    const isParticipant =
      deal.investorId._id.toString() === req.user._id.toString() ||
      deal.entrepreneurId._id.toString() === req.user._id.toString();

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
// @desc    Update deal status, terms, or notes
// @access  Private — Investor (own deals only)
// ────────────────────────────────────────────────────────────────────
export const updateDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found." });
    }

    if (deal.investorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const allowed = ["status", "amount", "equity", "stage", "notes", "meetingId"];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    updates.lastActivity = new Date();

    const updated = await Deal.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate("investorId", "name email profilePic")
      .populate("entrepreneurId", "name email profilePic startupName");

    res.status(200).json({ success: true, deal: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   DELETE /api/deals/:id
// @desc    Delete/remove a deal (investor only)
// @access  Private — Investor
// ────────────────────────────────────────────────────────────────────
export const deleteDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found." });
    }

    if (deal.investorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    await deal.deleteOne();
    res.status(200).json({ success: true, message: "Deal removed." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

