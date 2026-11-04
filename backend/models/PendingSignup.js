const mongoose = require("mongoose");

// Signup ka data tab tak yahan rehta hai jab tak user email ka 6 digit code sahi na daale.
// Asli User account code sahi hone ke baad hi banta hai.
const pendingSignupSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true }, // bcrypt hash, asli password kabhi save nahi hota
  otpHash: { type: String, required: true },      // code ka HMAC hash, asli code save nahi hota
  signupIdHash: { type: String, required: true }, // is signup ko shuru karne wale browser ki pehchaan
  attempts: { type: Number, default: 0 },
  sendCount: { type: Number, default: 1 },
  lastSentAt: { type: Date, default: Date.now },
  // TTL index: MongoDB expiresAt ke baad document apne aap delete kar deta hai (1 minute tak der ho sakti hai)
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

module.exports = mongoose.model("PendingSignup", pendingSignupSchema);