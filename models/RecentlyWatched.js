const mongoose = require("mongoose");

const recentlyWatchedSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  movieId: { type: Number, required: true }, // TMDB movie ID
  title: { type: String, required: true },
  posterPath: String,
  durationWatched: Number, // Duration in minute
  totalDuration: Number, // Total duration in minute
  progressPercentage: { type: Number, default: 0 },
  watchedDate: { type: Date, default: Date.now },
  genres: [{ type: String }],
});

module.exports = mongoose.model("recentlywatcheds", recentlyWatchedSchema);
