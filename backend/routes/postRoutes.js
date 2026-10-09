const express = require("express");
const Post = require("../models/Post");
const Report = require("../models/Report");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/posts?category=lost&search=bottle  (public)
router.get("/", async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    // 3 ya zyada reports wali posts public feed se chhup jaati hain
    filter.reportCount = { $lt: 3 };

    if (category && category !== "all") filter.category = category;
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: safe, $options: "i" } },
        { description: { $regex: safe, $options: "i" } },
      ];
    }

    const posts = await Post.find(filter)
      .populate("postedBy", "name")
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/posts/mine  (login required) - dashboard ke liye
// Ye /:id se PEHLE hona zaroori hai
router.get("/mine", auth, async (req, res) => {
  try {
    const posts = await Post.find({ postedBy: req.userId }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/posts/:id  (public)
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("postedBy", "name");
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(400).json({ message: "Invalid post id" });
  }
});

// POST /api/posts  (login required)
router.post("/", auth, async (req, res) => {
  try {
    const { title, description, category, location, date, price, photoUrl, tags } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ message: "Title, description and category are required" });
    }

    const post = await Post.create({
      title, description, category, location, date, price, photoUrl, tags,
      postedBy: req.userId,
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/posts/:id  (only owner)
router.put("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.postedBy.toString() !== req.userId) {
      return res.status(403).json({ message: "Not your post" });
    }

    const fields = ["title", "description", "category", "location", "date", "price", "photoUrl", "tags"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) post[f] = req.body[f];
    });

    await post.save();
    res.json(post);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/posts/:id/status  (only owner)
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.postedBy.toString() !== req.userId) {
      return res.status(403).json({ message: "Not your post" });
    }

    post.status = req.body.status === "open" ? "open" : "resolved";
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/posts/:id  (only owner)
router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.postedBy.toString() !== req.userId) {
      return res.status(403).json({ message: "Not your post" });
    }

    await post.deleteOne();
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(400).json({ message: "Invalid post id" });
  }
});

// POST /api/posts/:id/report  (login required)
router.post("/:id/report", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.postedBy.toString() === req.userId) {
      return res.status(400).json({ message: "You can't report your own post" });
    }

    await Report.create({
      postId: post._id,
      reportedBy: req.userId,
      reason: req.body.reason || "",
    });

    post.reportCount += 1;
    await post.save();

    res.json({ message: "Report submitted. Thank you." });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "You already reported this post" });
    }
    res.status(400).json({ message: "Invalid request" });
  }
});

module.exports = router;