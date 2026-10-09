const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
    isClaim: { type: Boolean, default: false },
    claimStatus: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Comment || mongoose.model("Comment", commentSchema);