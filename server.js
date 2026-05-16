import "dotenv/config"
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import cookieParser from "cookie-parser";


import authRoutes from "./src/routes/auths.js";
import userRoutes from "./src/routes/users.js";
import meetingRoutes from "./src/routes/meetings.js";
import docRoutes from "./src/routes/docs.js";
import paymentRoutes from "./src/routes/payments.js";
import collaborationRoutes from "./src/routes/collaborationRequest.js";
import messageRoutes from "./src/routes/message.js";
import notificationRoutes from "./src/routes/notification.js";
import dealRoutes from "./src/routes/deals.js";



const app = express();

// ── Security Middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));


app.use(cookieParser());
// ── Body Parsers ───────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Static Files (uploaded docs) ───────────────────────────────────
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Routes ─────────────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/users",    userRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/docs",     docRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/collaborations", collaborationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/deals", dealRoutes);


// ── Health Check ───────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "✅ Nexus backend running", timestamp: new Date().toISOString() });
});

// ── 404 Handler ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Global Error Handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error.",
  });
});

// ── MongoDB Connection + Start Server ─────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

export default app;
