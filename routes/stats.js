const express = require("express");
const auth = require("../middleware/auth.middleware");
const WatchHistory = require("../models/RecentlyWatched");
const mongoose = require("mongoose");

const router = express.Router();

// GET: Watch Statistics
router.get("/", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { type } = req.query; // "week" atau "month"
    const now = new Date();
    let startDate;

    if (type === "week") {
      startDate = new Date();
      startDate.setDate(now.getDate() - 6);
    } else if (type === "month") {
      startDate = new Date();
      startDate.setMonth(now.getMonth() - 1);
    } else {
      return res.status(400).json({
        status: "error",
        message: "Invalid type parameter. Use 'week' or 'month'",
      });
    }

    // Total film ditonton dan yang selesai (>=90%)
    const [totalWatched, totalCompleted] = await Promise.all([
      WatchHistory.countDocuments({ user: userId }),
      WatchHistory.countDocuments({
        user: userId,
        progressPercentage: { $gte: 90 },
      }),
    ]);

    // Total durasi menonton dalam menit
    const totalDurationResult = await WatchHistory.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: "$durationWatched" } } },
    ]);

    // Genre paling sering dari semua tontonan
    const mostWatchedGenres = await WatchHistory.aggregate([
      { $match: { user: userId } },
      { $unwind: "$genres" },
      {
        $group: {
          _id: "$genres",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, genre: "$_id", count: 1 } },
    ]);

    // Genre dari 10 tontonan terakhir
    const recentGenres = await WatchHistory.aggregate([
      { $match: { user: userId } },
      { $sort: { watchedDate: -1 } },
      { $limit: 10 },
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

    // Statistik berdasarkan periode
    let watchHistoryByPeriod = [];
    const periodPipeline = {
      week: [
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$watchedDate" },
            },
            totalDuration: { $sum: "$durationWatched" },
            totalMovies: { $sum: 1 },
            totalCompleted: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      "$durationWatched",
                      { $multiply: ["$duration", 0.9] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: "$_id",
            totalDuration: 1,
            totalMovies: 1,
            totalCompleted: 1,
          },
        },
      ],
      month: [
        {
          $group: {
            _id: {
              year: { $year: "$watchedDate" },
              week: { $isoWeek: "$watchedDate" },
            },
            totalDuration: { $sum: "$durationWatched" },
            totalMovies: { $sum: 1 },
            totalCompleted: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      "$durationWatched",
                      { $multiply: ["$duration", 0.9] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { "_id.year": 1, "_id.week": 1 } },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            week: "$_id.week",
            totalDuration: 1,
            totalMovies: 1,
            totalCompleted: 1,
          },
        },
      ],
    };

    if (type) {
      watchHistoryByPeriod = await WatchHistory.aggregate([
        { $match: { user: userId, watchedDate: { $gte: startDate } } },
        ...periodPipeline[type],
      ]);
    }

    res.json({
      status: "success",
      message: "Watch statistics retrieved successfully",
      data: {
        totalMoviesWatched: totalWatched,
        totalCompletedMovies: totalCompleted,
        totalWatchTime: totalDurationResult[0]?.total || 0,
        mostWatchedGenres,
        recentActivity: recentGenres,
        watchHistoryByPeriod: watchHistoryByPeriod.map((period) => ({
          ...period,
          // Tambah persentase komplet untuk FE
          completionRate:
            period.totalMovies > 0
              ? Math.round((period.totalCompleted / period.totalMovies) * 100)
              : 0,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching watch statistics:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

module.exports = router;
