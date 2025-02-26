const mongoose = require("mongoose");

const recentlyWatchedSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  movieId: { type: Number, required: true }, // TMDB movie ID
  title: { type: String, required: true },
  posterPath: String,
  progressPercentage: { type: Number, default: 0 },
  watchedDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model("recentlywatcheds", recentlyWatchedSchema);
