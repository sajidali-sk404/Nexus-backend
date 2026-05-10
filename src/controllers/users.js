import express from "express";
import User from "../models/User.js";


// ────────────────────────────────────────────────────────────────────

// @route   GET /api/users
// @desc    Get all users (for discovery — investors see entrepreneurs & vice versa)
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getUsers = (
  async (req, res) => {
    try {
      const { role, industry, page = 1, limit = 10, search } = req.query;

      const filter = { isActive: true, _id: { $ne: req.user._id } };

      if (role) filter.role = role;
      if (industry) filter.industry = new RegExp(industry, "i");
      if (search) {
        filter.$or = [
          { name: new RegExp(search, "i") },
          { startupName: new RegExp(search, "i") },
          { bio: new RegExp(search, "i") },
        ];
      }

      const skip = (page - 1) * limit;

      const users = await User.find(filter)
        .select("name email role bio profilePic location industry startupName startupStage investmentFocus")
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 });

      const total = await User.countDocuments(filter);

      res.status(200).json({
        success: true,
        count: users.length,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
        users,
      });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  });

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/users/investors
// @desc    Get all investors
// @access  Private (Entrepreneurs only)
// ────────────────────────────────────────────────────────────────────
export const getInvestors = (
  async (req, res) => {
    try {
      const investors = await User.find({ role: "investor", isActive: true })
        .select("name email bio profilePic location investmentFocus minInvestment maxInvestment portfolioSize")
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, count: investors.length, investors });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
);

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/users/entrepreneurs
// @desc    Get all entrepreneurs
// @access  Private (Investors only)
// ────────────────────────────────────────────────────────────────────
export const getEntrepreneurs = (
  async (req, res) => {
    try {
      const entrepreneurs = await User.find({ role: "entrepreneur", isActive: true })
        .select("name email bio profilePic location industry startupName startupStage fundingNeeded")
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, count: entrepreneurs.length, entrepreneurs });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
);

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/users/:id
// @desc    Get single user profile
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getUser = (
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select("-password -twoFactorOTP -twoFactorExpiry");

      if (!user) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      res.status(200).json({ success: true, user });
    } catch (error) {
      if (error.kind === "ObjectId") {
        return res.status(404).json({ success: false, message: "User not found." });
      }
      res.status(500).json({ success: false, message: "Server error." });
    }
  });

// ────────────────────────────────────────────────────────────────────
// @route   PUT /api/users/:id
// @desc    Update user profile (own profile only)
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const updateUser = (
  async (req, res) => {
    try {
      // Fields that cannot be updated via this route
      const forbidden = ["password", "email", "role", "twoFactorOTP", "twoFactorExpiry"];
      forbidden.forEach((field) => delete req.body[field]);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// ────────────────────────────────────────────────────────────────────
// @route   DELETE /api/users/:id
// @desc    Deactivate account (soft delete)
// @access  Private (own account only)
// ────────────────────────────────────────────────────────────────────
export const deleteUser = (
  async (req, res) => {
    try {
      await User.findByIdAndUpdate(req.params.id, { isActive: false });
      res.status(200).json({ success: true, message: "Account deactivated successfully." });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
);


