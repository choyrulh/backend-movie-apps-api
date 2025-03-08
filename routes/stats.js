const express = require("express");
const auth = require("../middleware/auth.middleware");
const WatchHistory = require("../models/RecentlyWatched");
const mongoose = require("mongoose");
const Favorites = require("../models/favorite.model");
const Watchlist = require("../models/watchlist.model");
const { getISOWeek } = require("../lib/function");

const router = express.Router();

// GET: Watch Statistics
router.get("/", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { type } = req.query;
    const now = new Date();
    let startDate;

    // Atur periode berdasarkan tipe
    if (type === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6); // 6 hari terakhir dari hari ini
      startDate.setHours(0, 0, 0, 0);
    } else if (type === "month") {
      startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000); // 4 minggu terakhir
      startDate.setHours(0, 0, 0, 0);
    } else {
      return res.status(400).json({
        status: "error",
        message: "Invalid type parameter. Use 'week' or 'month'",
      });
    }

    // [1] Ambil data statistik utama
    const [totalWatched, totalCompleted, totalFavorites, totalWatchlist] =
      await Promise.all([
        WatchHistory.countDocuments({ user: userId }),
        WatchHistory.countDocuments({
          user: userId,
          progressPercentage: { $gte: 90 },
        }),
        Favorites.countDocuments({ user: userId }),
        Watchlist.countDocuments({ user: userId }),
      ]);

    // [2] Total durasi menonton
    const totalDurationResult = await WatchHistory.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: "$durationWatched" } } },
    ]);

    // [3] Genre paling sering ditonton
    const mostWatchedGenres = await WatchHistory.aggregate([
      { $match: { user: userId } },
      { $unwind: "$genres" },
      { $group: { _id: "$genres", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, genre: "$_id", count: 1 } },
    ]);

    // [4] Genre dari 10 tontonan terakhir
    const recentGenres = await WatchHistory.aggregate([
      { $match: { user: userId } },
      { $sort: { watchedDate: -1 } },
      { $limit: 10 },
      { $unwind: "$genres" },
      { $group: { _id: "$genres", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, genre: "$_id", count: 1 } },
    ]);

    // [5] Statistik periode
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
              $sum: { $cond: [{ $gte: ["$progressPercentage", 90] }, 1, 0] },
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
              $sum: { $cond: [{ $gte: ["$progressPercentage", 90] }, 1, 0] },
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
      const aggregationResult = await WatchHistory.aggregate([
        { $match: { user: userId, watchedDate: { $gte: startDate } } },
        ...periodPipeline[type],
      ]);

      // Generate data untuk periode kosong
      if (type === "week") {
        const datesInRange = [];
        const currentDate = new Date(startDate);
        while (currentDate <= now) {
          datesInRange.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }

        watchHistoryByPeriod = datesInRange.map((date) => {
          const formattedDate = date.toISOString().split("T")[0];
          const found = aggregationResult.find((d) => d.date === formattedDate);
          return found
            ? {
                ...found,
                completionRate: Math.round(
                  (found.totalCompleted / (found.totalMovies || 1)) * 100
                ),
              }
            : {
                date: formattedDate,
                totalDuration: 0,
                totalMovies: 0,
                totalCompleted: 0,
                completionRate: 0,
              };
        });
      } else if (type === "month") {
        const expectedWeeks = [];
        for (let i = 3; i >= 0; i--) {
          const targetDate = new Date(
            now.getTime() - i * 7 * 24 * 60 * 60 * 1000
          );
          expectedWeeks.push({
            year: targetDate.getFullYear(),
            week: getISOWeek(targetDate),
          });
        }

        watchHistoryByPeriod = expectedWeeks.map((ew) => {
          const found = aggregationResult.find(
            (d) => d.year === ew.year && d.week === ew.week
          );
          return found
            ? {
                ...found,
                completionRate: Math.round(
                  (found.totalCompleted / (found.totalMovies || 1)) * 100
                ),
              }
            : {
                year: ew.year,
                week: ew.week,
                totalDuration: 0,
                totalMovies: 0,
                totalCompleted: 0,
                completionRate: 0,
              };
        });
      }
    }

    res.json({
      status: "success",
      message: "Watch statistics retrieved successfully",
      data: {
        totalMoviesWatched: totalWatched,
        totalCompletedMovies: totalCompleted,
        totalFavorites,
        totalWatchlist,
        totalWatchTime: totalDurationResult[0]?.total || 0,
        mostWatchedGenres,
        recentActivity: recentGenres,
        watchHistoryByPeriod,
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
