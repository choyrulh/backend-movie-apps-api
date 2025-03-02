const express = require("express");
const auth = require("../middleware/auth.middleware");
const Watchlist = require("../models/watchlist.model");

const router = express.Router();

// Get watchlist
router.get("/", auth, async (req, res) => {
  try {
    const watchlist = await Watchlist.find({ user: req.user.userId }).sort({
      addedAt: -1,
    });
    res.json({
      message: "Watchlist retrieved",
      status: 200,
      length: watchlist.length,
      watchlist,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Add to watchlist
router.post("/", auth, async (req, res) => {
  try {
    const {
      movieId,
      title,
      poster,
      type,
      release_date,
      backdrop_path,
      vote_average,
      genres,
    } = req.body;

    const existing = await Watchlist.findOne({
      user: req.user.userId,
      movieId,
    });

    if (existing) {
      return res.status(400).json({
        message: "Movie already in watchlist",
      });
    }

    const watchlistItem = new Watchlist({
      user: req.user.userId,
      movieId,
      title,
      poster,
      type,
      release_date,
      backdrop_path,
      vote_average,
      genres,
    });

    await watchlistItem.save();
    res.status(201).json({
      message: "Added to watchlist",
      watchlistItem,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Remove from watchlist
router.delete("/:movieId", auth, async (req, res) => {
  try {
    await Watchlist.findOneAndDelete({
      movieId: req.params.movieId,
      user: req.user.userId,
    });
    res.json({ message: "Removed from watchlist" });
  } catch (error) {
    res.json({
      status: 500,
      message: "Server error",
    });
  }
});

// Clear watchlist
router.delete("/", auth, async (req, res) => {
  try {
    await Watchlist.deleteMany({ user: req.user.userId });
    res.json({ message: "Watchlist cleared" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
