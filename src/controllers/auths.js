import express from "express";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { sendEmail, generateOTP, getOTPEmailTemplate } from '../utils/sendEmail.js';




// ── Helper: Generate JWT ───────────────────────────────────────────
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// ── Helper: Send token response ────────────────────────────────────
const sendTokenResponse = (
  user,
  statusCode,
  res
) => {
  const token = generateToken(user._id);

  user.password = undefined;

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(statusCode).json({
    success: true,
    token,
    user,
  });
};

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
// ────────────────────────────────────────────────────────────────────
export const register = async (req, res) => {
  // express-validator errors
  const validationErrors = validationResult(req);

  if (!validationErrors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: validationErrors.array(),
    });
  }

  try {
    const { name, email, password, role } = req.body;

    // custom validation array
    const errors = [];

    if (!name?.trim())
      errors.push("Name is required");
    else if (name.trim().length < 2)
      errors.push("Name must be at least 2 characters");
    else if (name.trim().length > 100)
      errors.push("Name must be under 100 characters");

    if (!email?.trim())
      errors.push("Email is required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push("Invalid email format");

    if (!password)
      errors.push("Password is required");
    else if (password.length < 8)
      errors.push("Password must be at least 8 characters");
    else if (!/[A-Za-z]/.test(password))
      errors.push("Password must contain at least one letter");
    else if (!/[0-9]/.test(password))
      errors.push("Password must contain at least one number");

    if (!role || !["entrepreneur", "investor"].includes(role))
      errors.push("Role must be either 'entrepreneur' or 'investor'");

    // return validation errors
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    // check email exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // create user
    const user = await User.create({
      name,
      email,
      password,
      role,
    });

    sendTokenResponse(user, 201, res);

  } catch (error) {
    console.error("Register error:", error);

    res.status(500).json({
      success: false,
      message: "Server error during registration.",
      error: error.message,
    });
  }
};

// POST /api/auth/2fa/send-otp
// Send OTP to user's email
// ────────────────────────────────────────────────────────────────────
export const sendTwoFactorOTP = async (req, res) => {
  try {
    const { email } = req.body;

    console.log('Send OTP request:', { email });

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.',
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const otp = generateOTP();

    // ✅ Save OTP
    user.twoFactorOTP = otp;
    user.twoFactorExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // ✅ VERIFY IT SAVED
    const checkUser = await User.findById(user._id);
    console.log('OTP saved check:', {
      savedOTP: checkUser.twoFactorOTP,
      savedExpiry: checkUser.twoFactorExpiry,
      userId: checkUser._id,
    });

    // Send email
    try {
      const template = getOTPEmailTemplate(user.name, otp);
      await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    } catch (emailErr) {
      console.log('Email failed, OTP:', otp);
    }

    console.log(`✅ OTP for ${email}: ${otp}`);

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email.',
      devOTP: otp,
    });
  } catch (error) {
    console.error('Send OTP error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ────────────────────────────────────────────────────────────────────
// POST /api/auth/2fa/verify-otp
// Verify OTP and complete login
// ────────────────────────────────────────────────────────────────────
export const verifyTwoFactorOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log('Verify OTP request:', { email, otp, otpType: typeof otp });


    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required.',
      });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }
    console.log('Stored OTP:', user.twoFactorOTP, 'Type:', typeof user.twoFactorOTP);
    console.log('Received OTP:', otp, 'Type:', typeof otp);
    console.log('Match:', user.twoFactorOTP === otp);
    console.log('Expiry:', user.twoFactorExpiry, 'Now:', new Date());
    console.log('Expired:', new Date() > new Date(user.twoFactorExpiry));
    // Check OTP
    if (!user.twoFactorOTP || user.twoFactorOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP.',
      });
    }

    // Check expiry
    if (!user.twoFactorExpiry || new Date() > user.twoFactorExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // ✅ Clear OTP after successful verification
    user.twoFactorOTP = null;
    user.twoFactorExpiry = null;
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.twoFactorOTP;
    delete userObj.twoFactorExpiry;

    res.status(200).json({
      success: true,
      message: '2FA verification successful.',
      token,
      user: userObj,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Verification failed.' });
  }
};

// ────────────────────────────────────────────────────────────────────
// PUT /api/auth/2fa/toggle
// Enable or disable 2FA
// ────────────────────────────────────────────────────────────────────
export const toggleTwoFactor = async (req, res) => {
  try {
    const { enable, otp } = req.body;

    console.log('Toggle 2FA request:', { enable, otp, userId: req.user._id });

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (enable) {
      if (!otp) {
        return res.status(400).json({
          success: false,
          message: 'OTP is required to enable 2FA.',
        });
      }

      // ✅ DEBUG: Log both values
      const receivedOTP = String(otp).trim();
      const storedOTP = String(user.twoFactorOTP || '').trim();

      console.log('Comparing OTPs:', {
        received: receivedOTP,
        stored: storedOTP,
        match: receivedOTP === storedOTP,
        expiry: user.twoFactorExpiry,
        now: new Date(),
        expired: user.twoFactorExpiry ? new Date() > new Date(user.twoFactorExpiry) : 'no expiry',
      });

      if (!storedOTP) {
        return res.status(400).json({
          success: false,
          message: 'No OTP found. Please request a new one.',
        });
      }

      // ✅ FIXED: Compare as trimmed strings
      if (receivedOTP !== storedOTP) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP.',
        });
      }

      // ✅ FIXED: Check expiry properly
      if (user.twoFactorExpiry && new Date() > new Date(user.twoFactorExpiry)) {
        return res.status(400).json({
          success: false,
          message: 'OTP expired. Please request a new one.',
        });
      }
    }

    // ✅ Toggle 2FA
    user.twoFactorEnabled = enable;
    user.twoFactorOTP = null;
    user.twoFactorExpiry = null;
    await user.save();

    console.log('✅ 2FA toggled:', { enabled: enable, user: user.email });

    res.status(200).json({
      success: true,
      message: `Two-factor authentication ${enable ? 'enabled' : 'disabled'}.`,
      twoFactorEnabled: user.twoFactorEnabled,
    });
  } catch (error) {
    console.error('Toggle 2FA error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
// ────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    // ✅ CHECK IF 2FA IS ENABLED
    if (user.twoFactorEnabled) {
      // Generate and send OTP
      const otp = generateOTP();

      user.twoFactorOTP = otp;
      user.twoFactorExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      // Send OTP email
      const emailTemplate = getOTPEmailTemplate(user.name, otp);
      await sendEmail({
        to: user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });

      console.log(`🔐 2FA OTP sent to ${user.email}: ${otp}`);

      return res.status(200).json({
        success: true,
        requires2FA: true,
        message: 'OTP sent to your email.',
        email: user.email,
        // Dev only
        ...(process.env.NODE_ENV !== 'production' && { devOTP: otp }),
      });
    }

    // Normal login
    sendTokenResponse(user, 200, res);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


export const logout = async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
    sameSite: "none",
    secure: true,
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
// @desc    Get currently logged-in user
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getMe = (
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      res.status(200).json({ success: true, user });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  });

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/send-otp
// @desc    Send 2FA OTP (mock - logs to console)
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const sendOtp = (
  async (req, res) => {
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
      const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await User.findByIdAndUpdate(req.user._id, {
        twoFactorOTP: otp,
        twoFactorExpiry: expiry,
      });

      // In production: send via Nodemailer. For mock, log to console.
      console.log(`🔐 OTP for ${req.user.email}: ${otp}`);

      res.status(200).json({
        success: true,
        message: `OTP sent to ${req.user.email}. (Check server console for mock OTP)`,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to generate OTP." });
    }
  });

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/verify-otp
// @desc    Verify 2FA OTP
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const verifyOtp = (
  async (req, res) => {
    try {
      const { otp } = req.body;
      const user = await User.findById(req.user._id);

      if (!user.twoFactorOTP || user.twoFactorOTP !== otp) {
        return res.status(400).json({ success: false, message: "Invalid OTP." });
      }

      if (new Date() > user.twoFactorExpiry) {
        return res.status(400).json({ success: false, message: "OTP has expired. Request a new one." });
      }

      // Clear OTP after successful verification
      await User.findByIdAndUpdate(req.user._id, {
        twoFactorOTP: null,
        twoFactorExpiry: null,
        twoFactorEnabled: true,
      });

      res.status(200).json({ success: true, message: "OTP verified successfully." });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  });

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/change-password
// @desc    Change password
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const changePassword = (
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "Both fields are required." });
      }

      const user = await User.findById(req.user._id).select("+password");
      const isMatch = await user.comparePassword(currentPassword);

      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Current password is incorrect." });
      }

      user.password = newPassword;
      await user.save(); // triggers bcrypt pre-save hook

      res.status(200).json({ success: true, message: "Password changed successfully." });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  });

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    // generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire =
      Date.now() + 15 * 60 * 1000; // 15 min

    await user.save();

    // send email here

    res.status(200).json({
      success: true,
      message:
        "Password reset instructions sent to your email",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


