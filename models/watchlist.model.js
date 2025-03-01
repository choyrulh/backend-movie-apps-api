const mongoose = require("mongoose");

const watchlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  movieId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  poster: String,
  addedAt: {
    type: Date,
    default: Date.now,
  },
  type: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Watchlist", watchlistSchema);
