const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { sendPasswordResetEmail, sendPasswordChangedEmail } = require("../utils/mailer");

const router = express.Router();

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
        const { name, email, password } = req.body || {};

    // Sirf asli text (string) accept karo. Object aaya to reject (NoSQL injection se bachav)
    if (
      typeof name !== "string" || typeof email !== "string" || typeof password !== "string" ||
      !name.trim() || !email.trim() || !password
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: normalizedEmail, password: hashedPassword });

    res.status(201).json({
      message: "Signup successful",
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
      const { email, password } = req.body || {};

    // Sirf asli text (string) accept karo. Object aaya to reject (NoSQL injection se bachav)
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
// ===== FORGOT PASSWORD =====
const MIN_PASSWORD_LENGTH = 6;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // link 15 minute tak valid
const RESET_COOLDOWN_MS = 60 * 1000;       // ek account ko 1 minute mein 1 hi email

const isString = (v) => typeof v === "string";
const cleanEmail = (v) => (isString(v) ? v.trim().toLowerCase() : "");
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const tooMany = { message: "Too many requests. Please try again later." };
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: tooMany });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: tooMany });

// POST /api/auth/forgot-password  { email }
// Email exist kare ya na kare, jawab hamesha same aata hai.
router.post("/forgot-password", forgotLimiter, async (req, res) => {
  const generic = { message: "If an account exists for that email, a password reset link has been sent." };
  try {
    const email = cleanEmail((req.body || {}).email);
    if (!email) {
      return res.status(400).json({ message: "Please enter your email" });
    }

    const user = await User.findOne({ email }).select("+resetPasswordExpires");
    if (user) {
      const issuedAt = user.resetPasswordExpires ? user.resetPasswordExpires.getTime() - RESET_TOKEN_TTL_MS : 0;
      if (Date.now() - issuedAt >= RESET_COOLDOWN_MS) {
        const token = crypto.randomBytes(32).toString("hex"); // 256-bit random token
        await User.updateOne(
          { _id: user._id },
          { $set: { resetPasswordToken: sha256(token), resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS) } }
        );
        // await nahi kiya: response time se pata na chale ki account hai ya nahi
        sendPasswordResetEmail(user.email, user.name, token).catch((err) =>
          console.error("Could not send reset email:", err.message)
        );
      }
    }
    res.json(generic);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/reset-password  { token, password }
router.post("/reset-password", resetLimiter, async (req, res) => {
  const invalid = { message: "This reset link is invalid or has expired. Please request a new one." };
  try {
    const { token, password } = req.body || {};

    if (!isString(token) || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json(invalid);
    }
    if (!isString(password) || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const hashedToken = sha256(token);
    const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: new Date() } });
    if (!user) {
      return res.status(400).json(invalid);
    }

    // Single-use: update tabhi match karta hai jab token abhi bhi stored aur unexpired ho,
    // aur usi operation mein token delete ho jaata hai.
    const result = await User.updateOne(
      { _id: user._id, resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: new Date() } },
      { $set: { password: hashedPassword }, $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } }
    );
    if (result.modifiedCount !== 1) {
      return res.status(400).json(invalid);
    }

    sendPasswordChangedEmail(user.email, user.name).catch((err) =>
      console.error("Could not send password-changed email:", err.message)
    );
    res.json({ message: "Password updated. You can now log in with your new password." });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
// PATCH /api/auth/me  (apna contact set karo)
router.patch("/me", auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { contact: req.body.contact || "" },
      { returnDocument: "after" }
    ).select("name email contact");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;