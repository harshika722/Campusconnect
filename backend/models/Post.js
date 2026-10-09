const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, enum: ["lost", "found", "resource"], required: true },
    location: { type: String, default: "" },
    date: { type: Date, default: Date.now },
    price: { type: Number, default: 0 },
    photoUrl: { type: String, default: "" },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    tags: [String],
    reportCount: { type: Number, default: 0 },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Post || mongoose.model("Post", postSchema);