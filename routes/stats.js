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
    const wibOffset = 7 * 60 * 60 * 1000; // Offset WIB dalam milidetik

    // 1. Hitung waktu saat ini dalam WIB dan UTC
    const nowUTC = new Date();
    const nowWIB = new Date(nowUTC.getTime() + wibOffset);

    let startDate;
    let startDateUTC;

    // 2. Tentukan periode berdasarkan tipe
    if (type === "week") {
      // Hitung awal hari ini di WIB (00:00 WIB)
      const startOfTodayWIB = new Date(nowWIB);
      startOfTodayWIB.setUTCHours(0, 0, 0, 0);

      // Convert ke UTC
      startDateUTC = new Date(startOfTodayWIB.getTime() - wibOffset);

      // Kurangi 6 hari untuk mendapatkan rentang mingguan
      startDate = new Date(startDateUTC.getTime() - 6 * 24 * 60 * 60 * 1000);
    } else if (type === "month") {
      // Hitung 28 hari terakhir dari awal hari ini di WIB
      const startOfTodayWIB = new Date(nowWIB);
      startOfTodayWIB.setUTCHours(0, 0, 0, 0);
      startDateUTC = new Date(startOfTodayWIB.getTime() - wibOffset);
      startDate = new Date(startDateUTC.getTime() - 28 * 24 * 60 * 60 * 1000);
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

    // [4] Genre dari 10 tontonan terakhir (UTC+7)
    const recentGenres = await WatchHistory.aggregate([
      { $match: { user: userId } },
      { $sort: { watchedDate: -1 } },
      { $limit: 10 },
      { $unwind: "$genres" },
      { $group: { _id: "$genres", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          genre: "$_id",
          count: 1,
          // Tambahkan waktu terakhir ditonton dalam WIB
          lastWatched: {
            $dateToString: {
              format: "%Y-%m-%dT%H:%M:%S",
              date: "$watchedDate",
              timezone: "+07:00",
            },
          },
        },
      },
    ]);

    // [5] Pipeline untuk statistik periode
    const periodPipeline = {
      week: [
        {
          $match: {
            user: userId,
            watchedDate: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$watchedDate",
                timezone: "+07:00",
              },
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
          $match: {
            user: userId,
            watchedDate: { $gte: startDate },
          },
        },
        {
          $addFields: {
            wibDate: { $add: ["$watchedDate", wibOffset] },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$wibDate" },
              week: { $isoWeek: "$wibDate" },
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

    let watchHistoryByPeriod = [];
    if (type) {
      const aggregationResult = await WatchHistory.aggregate(
        periodPipeline[type]
      );

      // Generate data untuk periode kosong
      if (type === "week") {
        const datesInRange = [];
        const currentDate = new Date(startDate.getTime() + wibOffset);
        const endDate = new Date(nowUTC.getTime() + wibOffset);

        while (currentDate <= endDate) {
          const formattedDate = currentDate.toISOString().split("T")[0];
          datesInRange.push(formattedDate);
          currentDate.setDate(currentDate.getDate() + 1);
        }

        watchHistoryByPeriod = datesInRange.map((date) => {
          const found = aggregationResult.find((d) => d.date === date);
          return {
            date,
            totalDuration: found?.totalDuration || 0,
            totalMovies: found?.totalMovies || 0,
            totalCompleted: found?.totalCompleted || 0,
            completionRate: found
              ? Math.round((found.totalCompleted / found.totalMovies) * 100) ||
                0
              : 0,
          };
        });
      } else if (type === "month") {
        const expectedWeeks = [];
        for (let i = 3; i >= 0; i--) {
          const targetDate = new Date(
            nowWIB.getTime() - i * 7 * 24 * 60 * 60 * 1000
          );
          expectedWeeks.push({
            year: targetDate.getUTCFullYear(),
            week: getISOWeek(targetDate),
          });
        }

        watchHistoryByPeriod = expectedWeeks.map((ew) => {
          const found = aggregationResult.find(
            (d) => d.year === ew.year && d.week === ew.week
          );
          return {
            year: ew.year,
            week: ew.week,
            totalDuration: found?.totalDuration || 0,
            totalMovies: found?.totalMovies || 0,
            totalCompleted: found?.totalCompleted || 0,
            completionRate: found
              ? Math.round((found.totalCompleted / found.totalMovies) * 100) ||
                0
              : 0,
          };
        });
      }
    }

    res.json({
      status: "success",
      message: "Statistik berhasil didapatkan",
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
      timezone: "UTC+7",
      lastUpdated: new Date().toLocaleString("en-US", {
        timeZone: "Asia/Jakarta",
      }),
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      status: "error",
      message: "Kesalahan server internal",
    });
  }
});

module.exports = router;
