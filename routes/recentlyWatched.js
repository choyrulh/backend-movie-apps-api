const router = require("express").Router();
const authMiddleware = require("../middleware/auth"); // Tambahkan ini
const RecentlyWatched = require("../models/RecentlyWatched");
const auth = require("../middleware/auth.middleware");
const mongoose = require("mongoose");
const WatchHistory = require("../models/RecentlyWatched");

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

    // Menambahkan perhitungan progressPercentage untuk setiap item dalam history
    const updatedHistory = history.map((item) => {
      const progressPercentage = (item.durationWatched / item.totalDuration) * 100;
      return {
        ...item._doc, // Menggunakan _doc untuk mengambil data dari mongoose document
        progressPercentage: Math.min(progressPercentage, 100).toFixed(1), // Pastikan progress tidak lebih dari 100%
      };
    });

    res.json({
      message: "Watch history retrieved",
      status: 200,
      length: updatedHistory.length,
      history: updatedHistory,
    });
  } catch (error) {
    console.error("Error retrieving watch history:", error);
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
      backdrop_path,
      duration,
      durationWatched,
      totalDuration,
      genres
    } = req.body;

    // Validasi input
    if (
      !movieId ||
      !title ||
      !poster ||
      !backdrop_path ||
      !duration ||
      !durationWatched ||
      !totalDuration ||
      !genres
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const watchEntry = await RecentlyWatched.findOneAndUpdate(
      { user: req.user.userId, movieId },
      {
        $set: {
          title,
          poster,
          backdrop_path,
          totalDuration,
          genres
        },
        $inc: { durationWatched: duration }, // Menambahkan durasi yang ditonton
        $max: { progressPercentage } // Pastikan progress hanya bertambah
      },
      { new: true, upsert: true }
    );

    await watchEntry.save();
    res.status(201).json({
      message: "Added to watch history",
      status: 201,
      watchEntry
    });
  } catch (error) {
    console.error("Error updating watch history:", error);
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

// Get total waktu menonton dengan optimasi
router.get("/watch-time", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { period } = req.query;
    const now = new Date();

    // Validasi parameter period
    const validPeriods = ["week", "month", undefined];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid period parameter. Use 'week', 'month' or omit for all-time",
      });
    }

    // Konfigurasi tanggal awal
    const dateFilter = {};
    if (period === "week") {
      dateFilter.watchedDate = {
        $gte: new Date(now.setDate(now.getDate() - 7)),
      };
    } else if (period === "month") {
      dateFilter.watchedDate = {
        $gte: new Date(now.setMonth(now.getMonth() - 1)),
      };
    }

    // Eksekusi paralel query menggunakan Promise.all
    const [totalStats, recentGenres, periodStats] = await Promise.all([
      // Total stats
      RecentlyWatched.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: null,
            totalWatched: { $sum: 1 },
            totalDuration: { $sum: "$durationWatched" },
            completedCount: {
              $sum: {
                $cond: [{ $gte: ["$progressPercentage", 90] }, 1, 0],
              },
            },
          },
        },
      ]),

      // Genre terbaru
      RecentlyWatched.aggregate([
        { $match: { user: userId } },
        { $sort: { watchedDate: -1 } },
        { $limit: 10 },
        { $unwind: "$genres" },
        {
          $group: {
            _id: "$genres",
            count: { $sum: 1 },
            lastWatched: { $max: "$watchedDate" },
          },
        },
        {
          $sort: {
            count: -1,
            lastWatched: -1,
          },
        },
        {
          $project: {
            genre: "$_id",
            count: 1,
            _id: 0,
          },
        },
      ]),

      // Stats berdasarkan periode
      period
        ? RecentlyWatched.aggregate([
            { $match: { user: userId, ...dateFilter } },
            {
              $group: {
                _id:
                  period === "week"
                    ? {
                        $dateToString: {
                          format: "%Y-%m-%d",
                          date: "$watchedDate",
                        },
                      }
                    : {
                        week: { $isoWeek: "$watchedDate" },
                        year: { $year: "$watchedDate" },
                      },
                totalDuration: { $sum: "$durationWatched" },
                watchedCount: { $sum: 1 },
                completedCount: {
                  $sum: {
                    $cond: [{ $gte: ["$progressPercentage", 90] }, 1, 0],
                  },
                },
              },
            },
            {
              $sort:
                period === "week"
                  ? { _id: 1 }
                  : { "_id.year": 1, "_id.week": 1 },
            },
            {
              $project: {
                _id: 0,
                date: period === "week" ? "$_id" : null,
                week: period === "month" ? "$_id.week" : null,
                year: period === "month" ? "$_id.year" : null,
                totalDuration: 1,
                watchedCount: 1,
                completedCount: 1,
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    // Format response
    const result = {
      status: "success",
      data: {
        totalWatched: totalStats[0]?.totalWatched || 0,
        totalDuration: totalStats[0]?.totalDuration || 0,
        completedCount: totalStats[0]?.completedCount || 0,
        recentGenres,
        periodStats: periodStats.map((stat) => ({
          ...stat,
          completionRate:
            stat.watchedCount > 0
              ? Math.round((stat.completedCount / stat.watchedCount) * 100)
              : 0,
        })),
        period: period || "all-time",
      },
    };

    res.json(result);
  } catch (error) {
    console.error("Error in /watch-time:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve watch statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
