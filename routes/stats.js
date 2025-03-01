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

    // ✅ Filter tanggal berdasarkan tipe
    if (type === "week") {
      startDate = new Date();
      startDate.setDate(now.getDate() - 6); // Ambil 7 hari terakhir (termasuk hari ini)
    } else if (type === "month") {
      startDate = new Date();
      startDate.setMonth(now.getMonth() - 1); // Ambil 1 bulan terakhir
    } else {
      return res.status(400).json({ status: "error", message: "Invalid type" });
    }

    // ✅ Total jumlah film yang ditonton
    const totalWatched = await WatchHistory.countDocuments({ user: userId });

    // ✅ Total waktu menonton dalam menit
    const totalDuration = await WatchHistory.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: "$durationWatched" } } },
    ]);

    // ✅ Mendapatkan genre terbaru yang paling sering ditonton
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

    let watchHistoryByPeriod = [];

    if (type === "week") {
      // ✅ Statistik per hari dalam 7 hari terakhir
      watchHistoryByPeriod = await WatchHistory.aggregate([
        { $match: { user: userId, watchedDate: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$watchedDate" },
            },
            totalDuration: { $sum: "$durationWatched" },
          },
        },
        { $sort: { _id: 1 } }, // Urutkan dari tanggal lama ke terbaru
        { $project: { _id: 0, date: "$_id", totalDuration: 1 } },
      ]);
    } else if (type === "month") {
      // ✅ Statistik per minggu dalam 1 bulan terakhir
      watchHistoryByPeriod = await WatchHistory.aggregate([
        { $match: { user: userId, watchedDate: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year: { $year: "$watchedDate" },
              week: { $isoWeek: "$watchedDate" },
            },
            totalDuration: { $sum: "$durationWatched" },
          },
        },
        { $sort: { "_id.year": 1, "_id.week": 1 } }, // Urutkan dari minggu lama ke terbaru
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            week: "$_id.week",
            totalDuration: 1,
          },
        },
      ]);
    }

    res.json({
      status: "success",
      message: "Watch statistics retrieved successfully",
      data: {
        totalMoviesWatched: totalWatched,
        totalWatchTime: totalDuration[0]?.total || 0,
        recentActivity: recentGenres,
        watchHistoryByPeriod, // ⬅️ Data sesuai periode
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
