const router = require("express").Router();
const authMiddleware = require("../middleware/auth"); // Tambahkan ini
const RecentlyWatched = require("../models/RecentlyWatched");
const auth = require("../middleware/auth.middleware");

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
      watchedAt: -1,
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
    const { movieId, title, poster, duration, progress } = req.body;

    const watchEntry = new RecentlyWatched({
      user: req.user.userId,
      movieId,
      title,
      poster,
      duration,
      progress,
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

module.exports = router;
