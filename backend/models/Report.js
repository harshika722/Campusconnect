const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, default: "" },
  },
  { timestamps: true }
);

// ek user ek post ko sirf ek baar report kar sakta hai
reportSchema.index({ postId: 1, reportedBy: 1 }, { unique: true });

module.exports = mongoose.models.Report || mongoose.model("Report", reportSchema);