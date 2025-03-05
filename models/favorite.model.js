const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  itemId: {
    type: Number, // Menggunakan Number untuk kompatibilitas ID TMDB
    required: true,
  },
  type: {
    type: String,
    enum: ["movie", "tv", "person"],
    required: true,
  },
  title: {
    type: String,
    required: function () {
      return this.type === "movie" || this.type === "tv";
    },
  },
  name: {
    type: String,
    required: function () {
      return this.type === "person";
    },
  },
  imagePath: String,
  addedAt: {
    type: Date,
    default: Date.now,
  },
  release_date: {
    type: String,
    required: true,
  },
  backdrop_path: String,
  vote_average: String,
  genres: [
    {
      id: { type: Number, required: true },
      name: { type: String, required: true },
    },
  ],
  isFavorites: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("Favorite", favoriteSchema);
