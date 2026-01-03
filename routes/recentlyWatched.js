const router = require("express").Router();
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
// ==========================================
// 1. GET ALL HISTORY (Dirapikan)
// ==========================================
router.get("/", auth, async (req, res) => {
  try {
    // Ambil semua history user, urutkan dari yang terbaru
    const allHistory = await RecentlyWatched.find({
      user: req.user.userId,
    })
      .sort({
        watchedDate: -1,
      })
      .lean(); // Gunakan .lean() untuk performa lebih cepat

    // Map untuk menyaring duplikat konten (hanya tampilkan episode/movie terakhir ditonton)
    const uniqueContentMap = new Map();

    allHistory.forEach((item) => {
      const key = item.contentId.toString();

      // Jika Movie: langsung simpan (atau replace jika ada duplikat teknis, ambil yang terbaru)
      if (item.type === "movie") {
        if (!uniqueContentMap.has(key)) {
          uniqueContentMap.set(key, item);
        }
      }
      // Jika TV: Kita ingin menampilkan series tersebut di list,
      // diwakili oleh episode TERAKHIR yang ditonton.
      else if (item.type === "tv") {
        const existingItem = uniqueContentMap.get(key);

        // Jika belum ada di map, masukkan
        if (!existingItem) {
          uniqueContentMap.set(key, item);
        }
        // Jika sudah ada, bandingkan tanggal watchedDate
        else if (
          new Date(item.watchedDate) > new Date(existingItem.watchedDate)
        ) {
          uniqueContentMap.set(key, item);
        }
      }
    });

    // Konversi Map kembali ke Array dan urutkan ulang berdasarkan tanggal
    const history = Array.from(uniqueContentMap.values()).sort(
      (a, b) => new Date(b.watchedDate) - new Date(a.watchedDate)
    );

    // Hitung persentase final untuk display
    const updatedHistory = history.map((item) => {
      // Fallback jika totalDuration 0 untuk menghindari NaN/Infinity
      const safeDuration = item.totalDuration || 1;
      const progressPercentage = (item.durationWatched / safeDuration) * 100;

      return {
        ...item,
        progressPercentage: Math.min(progressPercentage, 100).toFixed(1),
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
// ==========================================
// 2. ADD/UPDATE WATCH HISTORY (UTAMA)
// ==========================================
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

    // 1. Validasi Dasar
    if (!contentId || !type) {
      return res.status(400).json({ message: "contentId dan type diperlukan" });
    }

    if (type === "tv" && (season === undefined || episode === undefined)) {
      return res
        .status(400)
        .json({ message: "Season dan episode diperlukan untuk TV" });
    }

    // 2. Normalisasi Data (PENTING: Frontend iframe sering mengirim string)
    const normalizedContentId = Number(contentId);
    const normalizedSeason = type === "tv" ? Number(season) : null;
    const normalizedEpisode = type === "tv" ? Number(episode) : null;

    // Pastikan angka valid untuk durasi
    const watchedVal = parseFloat(durationWatched || 0);
    const durationVal = parseFloat(totalDuration || 0);

    // Hitung persentase di backend agar konsisten
    let progressPercentage = 0;
    if (durationVal > 0) {
      progressPercentage = (watchedVal / durationVal) * 100;
      // Cap di 100% dan 0%
      progressPercentage = Math.min(
        Math.max(progressPercentage, 0),
        100
      ).toFixed(2);
    }

    // 3. Buat Filter Pencarian
    const filter = {
      user: req.user.userId,
      contentId: normalizedContentId,
      type,
    };

    // Jika TV, filter harus spesifik ke episode tersebut
    if (type === "tv") {
      filter.season = normalizedSeason;
      filter.episode = normalizedEpisode;
    }

    // 4. Data yang akan di-update atau di-insert
    const updateData = {
      $set: {
        title,
        poster, // Pastikan field ini match dengan frontend (poster vs poster_path)
        backdrop_path,
        genres,
        totalDuration: durationVal,
        durationWatched: watchedVal,
        progressPercentage: Number(progressPercentage),
        watchedDate: new Date(), // Selalu update waktu tonton ke sekarang
      },
      // $setOnInsert bisa digunakan jika ada field yang hanya ingin diset saat create baru
    };

    // 5. Eksekusi Atomic Update (Upsert)
    // findOneAndUpdate dengan option upsert: true akan mengupdate jika ada, atau membuat baru jika tidak ada.
    // Ini mencegah race condition saat request dikirim cepat berulang kali.
    const watchEntry = await RecentlyWatched.findOneAndUpdate(
      filter,
      updateData,
      {
        new: true, // Kembalikan data setelah diupdate
        upsert: true, // Buat baru jika tidak ditemukan
        setDefaultsOnInsert: true, // Jalankan default value schema
      }
    );

    res.status(200).json(watchEntry);
  } catch (error) {
    console.error("Error saving watch history:", error);
    // Cek duplikasi key error mongo (jarang terjadi dengan logika upsert, tapi jaga-jaga)
    if (error.code === 11000) {
      return res.status(409).json({ message: "Duplicate entry detected" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================================
// 3. DELETE SPECIFIC ENTRY
// ==========================================
router.delete("/:id", auth, async (req, res) => {
  try {
    const entry = await RecentlyWatched.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    // Logic Hapus:
    // Jika User menghapus item dari list "Recently Watched" (misal: Series The Boys),
    // Biasanya user berekspektasi SELURUH progress series itu hilang, bukan cuma episode terakhirnya.
    if (entry.type === "tv") {
      await RecentlyWatched.deleteMany({
        user: req.user.userId,
        contentId: entry.contentId,
        type: "tv",
      });
    } else {
      await RecentlyWatched.findByIdAndDelete(req.params.id);
    }

    res.json({ message: "Watch history entry removed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================================
// 4. CLEAR ALL HISTORY
// ==========================================
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

// ==========================================
// 7. GET TV SHOW OVERVIEW (Progress per Season/Episode)
// ==========================================
router.get("/tv-progress/:contentId", auth, async (req, res) => {
  try {
    const contentId = Number(req.params.contentId);

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
        episodes: [],
        totalEpisodesWatched: 0,
        hasWatchedEpisodes: false,
      });
    }

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

    res.json({
      contentId,
      userId: req.user.userId,
      title: episodes[0].title,
      posterPath: episodes[0].poster,
      episodes: formattedEpisodes,
      totalEpisodesWatched: episodes.length,
      hasWatchedEpisodes: true,
    });
  } catch (error) {
    console.error("Error retrieving TV progress:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================================
// 6. CHECK PROGRESS SPECIFIC EPISODE (PENTING untuk Resume Playback)
// ==========================================
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
      // Return objek kosong dengan struktur yang diharapkan frontend
      // agar tidak error saat mengakses property .watched dll
      return res.json({
        contentId,
        userId: req.user.userId,
        season,
        episode,
        watched: 0, // frontend menggunakan field 'watched' di beberapa tempat
        durationWatched: 0,
        totalDuration: 0,
        progressPercentage: 0,
      });
    }

    res.json({
      ...episodeProgress.toObject(),
      watched: episodeProgress.durationWatched, // Alias untuk kompatibilitas
    });
  } catch (error) {
    console.error("Error retrieving episode progress:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
