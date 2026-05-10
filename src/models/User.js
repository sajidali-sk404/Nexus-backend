import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, "Invalid email format"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // never return password in queries
    },
    role: {
      type: String,
      enum: ["investor", "entrepreneur"],
      required: [true, "Role is required"],
    },

    // ── Profile Info ───────────────────────────────────────────────
    bio: { type: String, default: "" },
    profilePic: { type: String, default: "" },
    location: { type: String, default: "" },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },

    // ── Entrepreneur specific ──────────────────────────────────────
    startupName: { type: String, default: "" },
    startupStage: {
      type: String,
      enum: ["idea", "mvp", "early", "growth", "scaling", ""],
      default: "",
    },
    industry: { type: String, default: "" },
    fundingNeeded: { type: Number, default: 0 },
    startupHistory: [
      {
        company: String,
        role: String,
        from: Date,
        to: Date,
        description: String,
      },
    ],

    // ── Investor specific ──────────────────────────────────────────
    investmentFocus: [{ type: String }],
    portfolioSize: { type: Number, default: 0 },
    minInvestment: { type: Number, default: 0 },
    maxInvestment: { type: Number, default: 0 },
    investmentHistory: [
      {
        company: String,
        amount: Number,
        year: Number,
        outcome: String,
      },
    ],

    // ── Security ───────────────────────────────────────────────────
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorOTP: { type: String, default: null },
    twoFactorExpiry: { type: Date, default: null },

    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Hash password before saving ────────────────────────────────────
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ── Compare password method ────────────────────────────────────────
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", UserSchema);
