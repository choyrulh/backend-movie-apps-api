const express = require("express");
const auth = require("../middleware/auth.middleware");
const Favorite = require("../models/favorite.model");

const router = express.Router();

// Get favorites
router.get("/", auth, async (req, res) => {
  try {
    const { type } = req.query;
    const query = { user: req.user.userId };

    if (type) {
      query.type = type;
    }

    const favorites = await Favorite.find(query).sort({ addedAt: -1 });
    res.json({
      message: "success",
      status: 200,
      length: favorites.length,
      favorites,
    });
  } catch (error) {
    res.json({
      message: "Internal server error",
      status: 500,
    });
  }
});

// Add to favorites
router.post("/", auth, async (req, res) => {
  try {
    const {
      itemId,
      type,
      name,
      imagePath,
      release_date,
      backdrop_path,
      vote_average,
      genres,
      title,
    } = req.body;

    // Validation
    if (!itemId || !type || !name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if already in favorites
    const existing = await Favorite.findOne({
      user: req.user.userId,
      itemId,
      type,
    });

    if (existing) {
      return res.status(400).json({
        message: "Item already in favorites",
      });
    }

    const favorite = new Favorite({
      user: req.user.userId,
      itemId,
      type,
      name,
      imagePath,
      backdrop_path,
      vote_average,
      release_date,
      genres,
      title,
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
router.delete("/:itemId", auth, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { type } = req.query;

    // if (!type) {
    //   return res
    //     .status(400)
    //     .json({ message: "Type query parameter is required" });
    // }

    const deleted = await Favorite.findOneAndDelete({
      user: req.user.userId,
      itemId,
      type,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Favorite not found" });
    }

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
