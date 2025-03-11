const mongoose = require("mongoose");

const recentlyWatchedSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  type: { type: String, enum: ["movie", "tv"], required: true }, // Tambahkan field type
  contentId: { type: Number, required: true }, // Ganti movieId menjadi contentId
  season: Number, // Tambahkan untuk TV
  episode: Number, // Tambahkan untuk TV
  totalEpisodes: Number, // Hanya untuk type: "tv"
  title: { type: String, required: true },
  poster: String,
  backdrop_path: String,
  duration: Number, // Duration in minute
  durationWatched: Number, // Duration in minute
  totalDuration: Number, // Total duration in minute
  progressPercentage: { type: Number, default: 0 },
  watchedDate: { type: Date, default: Date.now },
  genres: [{ type: String }],
});

// improvement performance
recentlyWatchedSchema.index({ user: 1, watchedDate: 1 });
recentlyWatchedSchema.index({ user: 1, contentId: 1 });

module.exports = mongoose.model("recentlywatcheds", recentlyWatchedSchema);
