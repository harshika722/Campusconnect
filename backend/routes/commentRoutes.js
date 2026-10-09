const express = require("express");
const jwt = require("jsonwebtoken");
const Comment = require("../models/Comment");
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

// Token ho toh user id nikalta hai, warna null (login zaroori nahi)
function getUserId(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.split(" ")[1], process.env.JWT_SECRET).id;
  } catch {
    return null;
  }
}

// POST /api/posts/:id/comments  (login required)
router.post("/posts/:id/comments", auth, async (req, res) => {
  try {
    const { text, isClaim } = req.body;
    if (!text) return res.status(400).json({ message: "Text is required" });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const claim = isClaim === true;

    if (claim) {
      if (post.postedBy.toString() === req.userId) {
        return res.status(400).json({ message: "You can't claim your own post" });
      }
      const existing = await Comment.findOne({
        postId: post._id, userId: req.userId, isClaim: true,
      });
      if (existing) {
        return res.status(400).json({ message: "You already sent a claim" });
      }
    }

    const comment = await Comment.create({
      postId: post._id,
      userId: req.userId,
      text,
      isClaim: claim,
      claimStatus: claim ? "pending" : "none",
    });

    res.status(201).json(comment);
  } catch (err) {
    res.status(400).json({ message: "Invalid request" });
  }
});

// GET /api/posts/:id/comments  (public, but claims are private)
router.get("/posts/:id/comments", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const me = getUserId(req);
    const isOwner = me && post.postedBy.toString() === me;

    const comments = await Comment.find({ postId: post._id })
      .populate("userId", "name")
      .sort({ createdAt: 1 });

    // Claims sirf poster ko aur claim karne wale ko dikhte hain
    const visible = comments.filter(
      (c) => !c.isClaim || isOwner || (me && c.userId._id.toString() === me)
    );

    res.json(visible);
  } catch (err) {
    res.status(400).json({ message: "Invalid post id" });
  }
});

// PATCH /api/comments/:id/claim  (only post owner)
router.patch("/comments/:id/claim", auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected" });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment || !comment.isClaim) {
      return res.status(404).json({ message: "Claim not found" });
    }

    const post = await Post.findById(comment.postId);
    if (post.postedBy.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the poster can review claims" });
    }

    comment.claimStatus = status;
    await comment.save();
    res.json(comment);
  } catch (err) {
    res.status(400).json({ message: "Invalid request" });
  }
});

// GET /api/posts/:id/contact  (poster, ya approved claimant)
router.get("/posts/:id/contact", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const isOwner = post.postedBy.toString() === req.userId;

    if (!isOwner) {
      const approved = await Comment.findOne({
        postId: post._id, userId: req.userId, isClaim: true, claimStatus: "approved",
      });
      if (!approved) {
        return res.status(403).json({ message: "Your claim is not approved yet" });
      }
    }

    const owner = await User.findById(post.postedBy).select("name contact");
    res.json({ name: owner.name, contact: owner.contact || "Poster hasn't added a contact yet" });
  } catch (err) {
    res.status(400).json({ message: "Invalid post id" });
  }
});

module.exports = router;