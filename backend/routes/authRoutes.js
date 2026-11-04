const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const PendingSignup = require("../models/PendingSignup");
const auth = require("../middleware/authMiddleware");
const { sendPasswordResetEmail, sendPasswordChangedEmail, sendSignupOtpEmail } = require("../utils/mailer");
const router = express.Router();

// ===== Common helpers =====
const MIN_PASSWORD_LENGTH = 6;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // reset link 15 minute tak valid
const RESET_COOLDOWN_MS = 60 * 1000;       // ek account ko 1 minute mein 1 hi reset email

const isString = (v) => typeof v === "string";
const cleanEmail = (v) => (isString(v) ? v.trim().toLowerCase() : "");
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const tooMany = { message: "Too many requests. Please try again later." };
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: tooMany });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: tooMany });
// ===== SIGNUP WITH EMAIL OTP =====
// Account tabhi banta hai jab user email par aaya 6 digit code sahi daale.
// Tab tak data PendingSignup mein rehta hai, aur 10 minute baad apne aap delete ho jaata hai.
const OTP_TTL_MS = 10 * 60 * 1000;          // code 10 minute valid
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;   // 2 codes ke beech kam se kam 1 minute
const OTP_MAX_ATTEMPTS = 5;                 // ek code par 5 galat try
const OTP_MAX_SENDS = 5;                    // ek signup mein zyada se zyada 5 codes
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: tooMany });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: tooMany });

const hmac = (value) => crypto.createHmac("sha256", process.env.JWT_SECRET).update(value).digest("hex");
const hashOtp = (email, otp) => hmac("otp:" + email + ":" + otp);
const hashSignupId = (id) => hmac("sid:" + id);
const makeOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ALLOWED_EMAIL_DOMAINS=college.edu,mail.college.edu  (khali ho to koi bhi email chalega)
function emailDomainAllowed(email) {
  const list = (process.env.ALLOWED_EMAIL_DOMAINS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.length === 0 || list.includes(email.split("@").pop());
}

// POST /api/auth/signup  { name, email, password }
// Sirf code bhejta hai. User account yahan NAHI banta.
router.post("/signup", signupLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!isString(name) || !isString(email) || !isString(password) || !name.trim() || !email.trim() || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const cleanName = name.trim();
    const normalizedEmail = cleanEmail(email);

    if (cleanName.length > 60) {
      return res.status(400).json({ message: "Name is too long" });
    }
    if (normalizedEmail.length > 254 || !EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }
    if (!emailDomainAllowed(normalizedEmail)) {
      return res.status(400).json({ message: "Please use your college email address" });
    }
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters` });
    }
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const now = Date.now();
    const pending = await PendingSignup.findOne({ email: normalizedEmail });
    const live = pending && pending.expiresAt.getTime() > now;
    if (live && now - pending.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return res.status(429).json({ message: "Please wait a minute before requesting another code." });
    }
    if (live && pending.sendCount >= OTP_MAX_SENDS) {
      return res.status(429).json({ message: "Too many codes were requested for this email. Please try again in a few minutes." });
    }

    const otp = makeOtp();
    const signupId = crypto.randomBytes(24).toString("hex"); // sirf is browser ke paas rehta hai
    const passwordHash = await bcrypt.hash(password, 10);

    await PendingSignup.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          name: cleanName,
          passwordHash,
          otpHash: hashOtp(normalizedEmail, otp),
          signupIdHash: hashSignupId(signupId),
          attempts: 0,
          lastSentAt: new Date(),
          expiresAt: new Date(now + OTP_TTL_MS),
          sendCount: live ? pending.sendCount + 1 : 1,
        },
      },
      { upsert: true }
    );

    try {
      await sendSignupOtpEmail(normalizedEmail, cleanName, otp);
    } catch (mailErr) {
      console.error("Could not send signup code:", mailErr.message);
      await PendingSignup.deleteOne({ email: normalizedEmail });
      return res.status(503).json({ message: "We could not send the verification email. Please try again in a minute." });
    }

    res.json({
      message: "We sent a 6-digit code to your email.",
      email: normalizedEmail,
      signupId,
      expiresInMinutes: OTP_TTL_MS / 60000,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(429).json({ message: "Please wait a minute before requesting another code." });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/signup/verify  { email, otp, signupId }
// Code sahi ho tabhi User account banta hai.
router.post("/signup/verify", otpLimiter, async (req, res) => {
  try {
    const { email, otp, signupId } = req.body || {};
    const normalizedEmail = cleanEmail(email);

    if (!normalizedEmail || !isString(otp) || !/^\d{6}$/.test(otp) || !isString(signupId) || !/^[a-f0-9]{48}$/.test(signupId)) {
      return res.status(400).json({ message: "Please enter the 6-digit code." });
    }

    // Pehle try gino (atomic), phir code check karo. Isse ek saath kitni bhi guesses 5 se zyada nahi ho sakti.
    const pending = await PendingSignup.findOneAndUpdate(
      { email: normalizedEmail, expiresAt: { $gt: new Date() }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" }
    );
    if (!pending) {
      return res.status(400).json({ message: "This code has expired or too many wrong attempts were made. Please request a new code." });
    }

    const ok =
      safeEqual(pending.signupIdHash, hashSignupId(signupId)) &&
      safeEqual(pending.otpHash, hashOtp(normalizedEmail, otp));
    if (!ok) {
      const left = OTP_MAX_ATTEMPTS - pending.attempts;
      return res.status(400).json({ message: `That code is incorrect. ${left} ${left === 1 ? "attempt" : "attempts"} left.` });
    }

    // Single-use: jo pehle delete kar le, wahi account bana sakta hai
    const claimed = await PendingSignup.findOneAndDelete({ _id: pending._id });
    if (!claimed) {
      return res.status(400).json({ message: "This code has expired or too many wrong attempts were made. Please request a new code." });
    }

    let user;
    try {
      user = await User.create({ name: claimed.name, email: claimed.email, password: claimed.passwordHash });
    } catch (createErr) {
      if (createErr && createErr.code === 11000) {
        return res.status(400).json({ message: "Email already registered" });
      }
      throw createErr;
    }

    res.status(201).json({
      message: "Signup successful",
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/signup/resend  { email, signupId }
router.post("/signup/resend", otpLimiter, async (req, res) => {
  try {
    const { email, signupId } = req.body || {};
    const normalizedEmail = cleanEmail(email);

    if (!normalizedEmail || !isString(signupId) || !/^[a-f0-9]{48}$/.test(signupId)) {
      return res.status(400).json({ message: "Please sign up again." });
    }

    const pending = await PendingSignup.findOne({ email: normalizedEmail });
    if (!pending || pending.expiresAt.getTime() <= Date.now() || !safeEqual(pending.signupIdHash, hashSignupId(signupId))) {
      return res.status(400).json({ message: "Please sign up again." });
    }
    if (pending.sendCount >= OTP_MAX_SENDS) {
      return res.status(429).json({ message: "Too many codes were requested. Please sign up again in a few minutes." });
    }

    const otp = makeOtp();
    const now = Date.now();
    const updated = await PendingSignup.findOneAndUpdate(
      { _id: pending._id, lastSentAt: { $lte: new Date(now - OTP_RESEND_COOLDOWN_MS) }, sendCount: { $lt: OTP_MAX_SENDS } },
      {
        $set: { otpHash: hashOtp(normalizedEmail, otp), attempts: 0, lastSentAt: new Date(now), expiresAt: new Date(now + OTP_TTL_MS) },
        $inc: { sendCount: 1 },
      },
      { returnDocument: "after" }
    );
    if (!updated) {
      return res.status(429).json({ message: "Please wait a minute before asking for a new code." });
    }

    try {
      await sendSignupOtpEmail(normalizedEmail, updated.name, otp);
    } catch (mailErr) {
      console.error("Could not resend signup code:", mailErr.message);
      return res.status(503).json({ message: "We could not send the verification email. Please try again in a minute." });
    }

    res.json({ message: "A new code was sent to your email.", expiresInMinutes: OTP_TTL_MS / 60000 });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ===== LOGIN =====
// POST /api/auth/login

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      !isString(email) ||
      !isString(password) ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const user = await User.findOne({
      email: cleanEmail(email),
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);

    return res.status(500).json({
      message: "Server error",
    });
  }
});

// ===== FORGOT PASSWORD =====
// POST /api/auth/forgot-password

router.post("/forgot-password", forgotLimiter, async (req, res) => {
  const generic = {
    message:
      "If an account exists for that email, a password reset link has been sent.",
  };

  try {
    const email = cleanEmail((req.body || {}).email);

    if (!email) {
      return res.status(400).json({
        message: "Please enter your email",
      });
    }

    const user = await User.findOne({ email }).select(
      "+resetPasswordExpires"
    );

    if (user) {
      const issuedAt = user.resetPasswordExpires
        ? user.resetPasswordExpires.getTime() - RESET_TOKEN_TTL_MS
        : 0;

      if (Date.now() - issuedAt >= RESET_COOLDOWN_MS) {
        const token = crypto.randomBytes(32).toString("hex");

        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              resetPasswordToken: sha256(token),
              resetPasswordExpires: new Date(
                Date.now() + RESET_TOKEN_TTL_MS
              ),
            },
          }
        );

        sendPasswordResetEmail(user.email, user.name, token).catch(
          (err) => console.error("Could not send reset email:", err.message)
        );
      }
    }

    return res.json(generic);
  } catch (err) {
    console.error("Forgot password error:", err.message);

    return res.status(500).json({
      message: "Server error",
    });
  }
});

// ===== RESET PASSWORD =====
// POST /api/auth/reset-password

router.post("/reset-password", resetLimiter, async (req, res) => {
  const invalid = {
    message:
      "This reset link is invalid or has expired. Please request a new one.",
  };

  try {
    const { token, password } = req.body || {};

    if (!isString(token) || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json(invalid);
    }

    if (!isString(password) || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    if (Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        message: "Password is too long",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedToken = sha256(token);

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json(invalid);
    }

    const result = await User.updateOne(
      {
        _id: user._id,
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() },
      },
      {
        $set: { password: hashedPassword },
        $unset: {
          resetPasswordToken: 1,
          resetPasswordExpires: 1,
        },
      }
    );

    if (result.modifiedCount !== 1) {
      return res.status(400).json(invalid);
    }

    sendPasswordChangedEmail(user.email, user.name).catch(
      (err) =>
        console.error("Could not send password-changed email:", err.message)
    );

    return res.json({
      message: "Password updated. You can now log in with your new password.",
    });
  } catch (err) {
    console.error("Reset password error:", err.message);

    return res.status(500).json({
      message: "Server error",
    });
  }
});

// ===== UPDATE PROFILE CONTACT =====
// PATCH /api/auth/me

router.patch("/me", auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { contact: req.body.contact || "" },
      { returnDocument: "after" }
    ).select("name email contact");

    return res.json(user);
  } catch (err) {
    console.error("Profile update error:", err.message);

    return res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;
