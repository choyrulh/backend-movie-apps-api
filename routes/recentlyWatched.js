const router = require("express").Router();
const authMiddleware = require("../middleware/auth"); // Tambahkan ini
const RecentlyWatched = require("../models/RecentlyWatched");
const auth = require("../middleware/auth.middleware");
const mongoose = require("mongoose");

// Tambahkan middleware auth untuk semua route
// router.use(authMiddleware);

// Get all recently watched
// router.get("/", async (req, res) => {
//   try {
//     const items = await RecentlyWatched.find({ user: req.user._id })
//       .sort("-watchedDate")
//       .lean();

//     // Transformasi data untuk response
//     const transformed = items.map((item) => ({
//       id: item._id,
//       movieId: item.movieId,
//       title: item.title,
//       posterPath: item.posterPath,
//       progressPercentage: item.progressPercentage,
//       watchedDate: item.watchedDate,
//     }));

//     res.json(transformed);
//   } catch (err) {
//     console.error("Error:", err);
//     res.status(500).json({
//       message: "Server error",
//       error: err.message,
//     });
//   }
// });

// Add recently watched
// router.post("/", async (req, res) => {
//   try {
//     const item = new RecentlyWatched({
//       user: req.user._id,
//       ...req.body,
//     });
//     await item.save();
//     res.status(201).json(item);
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// });

// Delete single item
// router.delete("/:id", async (req, res) => {
//   try {
//     await RecentlyWatched.findOneAndDelete({
//       _id: req.params.id,
//       user: req.user._id,
//     });
//     res.json({ message: "Item deleted" });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// Clear all history
// router.delete("/clear/all", async (req, res) => {
//   try {
//     await RecentlyWatched.deleteMany({ user: req.user._id });
//     res.json({ message: "All history cleared" });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });
// Get watch history
router.get("/", auth, async (req, res) => {
  try {
    const history = await RecentlyWatched.find({ user: req.user.userId }).sort({
      watchedAt: -1, // Urutkan dari yang terakhir ditonton
    });
    res.json({
      message: "Watch history retrieved",
      status: 200,
      length: history.length,
      history,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Add to watch history
router.post("/", auth, async (req, res) => {
  try {
    const {
      movieId,
      title,
      poster,
      duration,
      progressPercentage,
      totalDuration,
      genres,
    } = req.body;

    const watchEntry = new RecentlyWatched({
      user: req.user.userId,
      movieId,
      title,
      poster,
      durationWatched: duration, // durationWatched
      totalDuration,
      progressPercentage,
      genres,
    });

    await watchEntry.save();
    res.status(201).json({
      message: "Added to watch history",
      status: 201,
      watchEntry,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete specific watch history entry
router.delete("/:id", auth, async (req, res) => {
  try {
    await RecentlyWatched.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId,
    });
    res.json({ message: "Watch history entry deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Clear all watch history
router.delete("/", auth, async (req, res) => {
  try {
    await RecentlyWatched.deleteMany({ user: req.user.userId });
    res.json({ message: "Watch history cleared" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get total waktu menonton
router.get("/watch-time", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { period } = req.query; // "week" atau "month"
    const now = new Date();
    let startDate;

    if (period === "week") {
      startDate = new Date();
      startDate.setDate(now.getDate() - 7); // 7 hari terakhir
    } else if (period === "month") {
      startDate = new Date();
      startDate.setMonth(now.getMonth() - 1); // 1 bulan terakhir
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

    // ✅ Hitung total durasi tontonan berdasarkan period
    let watchHistoryByPeriod = [];
    if (period === "week") {
      // Per hari dalam 7 hari terakhir
      watchHistoryByPeriod = await WatchHistory.aggregate([
        { $match: { user: userId, watchedDate: { $gte: startDate } } },
        { $addFields: { watchedDate: { $toDate: "$watchedDate" } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$watchedDate" },
            },
            totalDuration: { $sum: "$durationWatched" },
          },
        },
        { $sort: { _id: -1 } },
        { $project: { _id: 0, date: "$_id", totalDuration: 1 } },
      ]);
    } else if (period === "month") {
      // Per minggu dalam 1 bulan terakhir
      watchHistoryByPeriod = await WatchHistory.aggregate([
        { $match: { user: userId, watchedDate: { $gte: startDate } } },
        { $addFields: { watchedDate: { $toDate: "$watchedDate" } } },
        {
          $group: {
            _id: {
              week: { $isoWeek: "$watchedDate" }, // Ambil nomor minggu
              year: { $year: "$watchedDate" }, // Ambil tahun
            },
            totalDuration: { $sum: "$durationWatched" },
          },
        },
        { $sort: { "_id.year": -1, "_id.week": -1 } },
        {
          $project: {
            _id: 0,
            week: "$_id.week",
            year: "$_id.year",
            totalDuration: 1,
          },
        },
      ]);
    }

    res.json({
      totalMinutes: watchTime[0]?.total || 0,
      completedCount: completedContent[0]?.completedCount || 0,
      period: period || "all-time",
    });
  } catch (error) {
    console.error("Error in /watch-time:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/progress/:movieId", auth, async (req, res) => {
  const progress = await RecentlyWatched.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(req.user.userId),
        movieId: Number(req.params.movieId),
      },
    },
    {
      $group: {
        _id: "$movieId",
        totalWatched: { $sum: "$durationWatched" },
        totalDuration: { $first: "$totalDuration" },
      },
    },
  ]);

  const result = progress[0] || { totalWatched: 0, totalDuration: 0 };
  res.json({
    movieId: Number(req.params.movieId),
    userId: req.user.userId,
    totalWatched: result.totalWatched,
    totalDuration: result.totalDuration,
    progress: (result.totalWatched / result.totalDuration) * 100,
    isCompleted: result.totalWatched >= result.totalDuration,
  });
});

module.exports = router;
