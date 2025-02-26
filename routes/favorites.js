const express = require("express");
const auth = require("../middleware/auth.middleware");
const Favorite = require("../models/favorite.model");

const router = express.Router();

// Get favorites
router.get("/", auth, async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user.userId }).sort({
      addedAt: -1,
    });
    res.json({
      message: "Favorites retrieved",
      status: 200,
      length: favorites.length,
      favorites,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Add to favorites
router.post("/", auth, async (req, res) => {
  try {
    const { movieId, title, poster } = req.body;

    const existing = await Favorite.findOne({
      user: req.user.userId,
      movieId,
    });

    if (existing) {
      return res.status(400).json({
        message: "Movie already in favorites",
      });
    }

    const favorite = new Favorite({
      user: req.user.userId,
      movieId,
      title,
      poster,
    });

    await favorite.save();
    res.status(201).json({
      message: "Added to favorites",
      favorite,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Remove from favorites
router.delete("/:movieId", auth, async (req, res) => {
  try {
    await Favorite.findOneAndDelete({
      movieId: req.params.movieId,
      user: req.user.userId,
    });
    res.json({ message: "Removed from favorites" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Clear all favorites
router.delete("/", auth, async (req, res) => {
  try {
    await Favorite.deleteMany({ user: req.user.userId });
    res.json({ message: "All favorites cleared" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
