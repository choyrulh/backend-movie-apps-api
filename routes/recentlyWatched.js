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
// Get watch history
router.get("/", auth, async (req, res) => {
  try {
    // First, get all watch history entries
    const allHistory = await RecentlyWatched.find({
      user: req.user.userId,
    }).sort({
      watchedDate: -1, // Sort by most recently watched
    });

    // Create a map to track the most recent entry for each unique contentId
    // For TV shows, we'll only keep the most recent episode
    const uniqueContentMap = new Map();

    // Process each history item
    allHistory.forEach((item) => {
      const key = item.contentId.toString();

      // For movies, or if this contentId hasn't been seen before, add it to the map
      if (item.type === "movie" || !uniqueContentMap.has(key)) {
        uniqueContentMap.set(key, item);
      }
      // For TV shows, only replace if this episode is more recently watched
      else if (item.type === "tv") {
        const existingItem = uniqueContentMap.get(key);
        if (new Date(item.watchedDate) > new Date(existingItem.watchedDate)) {
          uniqueContentMap.set(key, item);
        }
      }
    });

    // Convert map values to array
    const history = Array.from(uniqueContentMap.values());

    // Sort by watchedDate to maintain chronological order
    history.sort((a, b) => new Date(b.watchedDate) - new Date(a.watchedDate));

    // Calculate progressPercentage for each item
    const updatedHistory = history.map((item) => {
      const progressPercentage =
        (item.durationWatched / item.totalDuration) * 100;
      return {
        ...item._doc, // Using _doc to get mongoose document data
        progressPercentage: Math.min(progressPercentage, 100).toFixed(1), // Ensure progress doesn't exceed 100%
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
// Add to watch history
router.post("/", auth, async (req, res) => {
  try {
    const {
      type,
      contentId,
      season,
      episode,
      title,
      poster,
      backdrop_path,
      durationWatched,
      totalDuration,
      genres,
    } = req.body;

    if (!contentId || !type) {
      return res.status(400).json({ message: "contentId dan type diperlukan" });
    }

    if (type === "tv" && (!season || !episode)) {
      return res
        .status(400)
        .json({ message: "Season dan episode diperlukan untuk TV" });
    }

    // Pastikan totalDuration tidak nol untuk menghindari NaN
    if (!totalDuration || totalDuration <= 0) {
      return res
        .status(400)
        .json({ message: "Durasi total harus lebih dari 0" });
    }

    // Buat filter sesuai dengan type (movie atau tv)
    // Untuk TV, harus mempertimbangkan season dan episode
    const filter = {
      user: req.user.userId,
      contentId,
      type,
      ...(type === "tv" && { season, episode }), // Tambahkan season dan episode ke filter jika typenya tv
    };

    console.log("filter", filter);

    // Hitung progress
    const progressPercentage = (
      (durationWatched / totalDuration) *
      100
    ).toFixed(1);

    // Cari data yang sudah ada
    let watchEntry = await RecentlyWatched.findOne(filter);
    console.log("watchEntry", watchEntry);

    if (watchEntry) {
      // Update data yang sudah ada
      watchEntry.title = title;
      watchEntry.poster = poster;
      watchEntry.backdrop_path = backdrop_path;
      watchEntry.totalDuration = totalDuration;
      watchEntry.genres = genres;
      watchEntry.durationWatched = durationWatched;
      watchEntry.progressPercentage = progressPercentage;
      watchEntry.watchedDate = new Date();

      console.log("watchEntry", watchEntry);

      await watchEntry.save();
    } else {
      // Buat entri baru jika tidak ditemukan
      watchEntry = await RecentlyWatched.create({
        user: req.user.userId,
        contentId,
        type,
        ...(type === "tv" && { season, episode }), // Hanya tambahkan untuk TV
        title,
        poster,
        backdrop_path,
        totalDuration,
        genres,
        durationWatched,
        progressPercentage,
        watchedDate: new Date(),
      });
    }

    res.status(201).json(watchEntry);
  } catch (error) {
    console.error("Error:", error);
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

// Get progress percentage for a specific movie
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

// Get TV show progress
router.get("/tv-progress/:contentId", auth, async (req, res) => {
  try {
    const contentId = Number(req.params.contentId);

    // Find all episodes watched for this TV show
    const episodes = await RecentlyWatched.find({
      user: req.user.userId,
      type: "tv",
      contentId: contentId,
    })
      .sort({ season: 1, episode: 1 })
      .lean();

    if (episodes.length === 0) {
      return res.json({
        contentId,
        userId: req.user.userId,
        episodes: [],
        totalEpisodesWatched: 0,
        hasWatchedEpisodes: false,
      });
    }

    // Format the response to include progress for each episode
    const formattedEpisodes = episodes.map((item) => ({
      season: item.season,
      episode: item.episode,
      title: item.title,
      durationWatched: item.durationWatched,
      totalDuration: item.totalDuration,
      progressPercentage: item.progressPercentage,
      isCompleted: item.progressPercentage >= 90,
      watchedDate: item.watchedDate,
    }));

    // Calculate the overall progress stats
    const totalWatchTime = episodes.reduce(
      (sum, ep) => sum + ep.durationWatched,
      0
    );
    const totalDuration = episodes.reduce(
      (sum, ep) => sum + ep.totalDuration,
      0
    );
    const completedEpisodes = episodes.filter(
      (ep) => ep.progressPercentage >= 90
    ).length;

    res.json({
      contentId,
      userId: req.user.userId,
      title: episodes[0].title, // Title of the TV show
      posterPath: episodes[0].poster,
      backdropPath: episodes[0].backdrop_path,
      episodes: formattedEpisodes,
      totalEpisodesWatched: episodes.length,
      completedEpisodes: completedEpisodes,
      totalWatchTime: totalWatchTime,
      overallProgress:
        totalDuration > 0
          ? ((totalWatchTime / totalDuration) * 100).toFixed(1)
          : 0,
      hasWatchedEpisodes: true,
      genres: episodes[0].genres,
    });
  } catch (error) {
    console.error("Error retrieving TV progress:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// get tv show progress by episode and season
router.get("/tv/:contentId/season/:s/episode/:ep", auth, async (req, res) => {
  try {
    const contentId = Number(req.params.contentId);
    const season = Number(req.params.s);
    const episode = Number(req.params.ep);

    const episodeProgress = await RecentlyWatched.findOne({
      user: req.user.userId,
      type: "tv",
      contentId: contentId,
      season: season,
      episode: episode,
    });

    if (!episodeProgress) {
      return res.json({
        contentId,
        userId: req.user.userId,
        season: season,
        episode: episode,
        title: "",
        durationWatched: 0,
        totalDuration: 0,
        progressPercentage: 0,
        isCompleted: false,
      });
    }

    res.json(episodeProgress);
  } catch (error) {
    console.error("Error retrieving episode progress:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
