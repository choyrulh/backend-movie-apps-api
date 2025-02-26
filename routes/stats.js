const express = require("express");
const auth = require("../middleware/auth.middleware");
const WatchHistory = require("../models/RecentlyWatched");

const router = express.Router();

// Get watch statistics
router.get("/", auth, async (req, res) => {
  try {
    const totalWatched = await WatchHistory.countDocuments({
      user: req.user.userId,
    });

    const totalDuration = await WatchHistory.aggregate([
      { $match: { user: req.user.userId } },
      { $group: { _id: null, total: { $sum: "$duration" } } },
    ]);

    const recentGenres = await WatchHistory.aggregate([
      { $match: { user: req.user.userId } },
      { $sort: { watchedAt: -1 } },
      { $limit: 5 },
      { $unwind: "$genres" },
      {
        $group: {
          _id: "$genres",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $project: { _id: 0, genre: "$_id", count: 1 } },
    ]);

    res.json({
      status: "success",
      message: "Watch statistics retrieved successfully",
      data: {
        totalMoviesWatched: totalWatched,
        totalWatchTime: totalDuration[0]?.total || 0,
        recentActivity: recentGenres,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
