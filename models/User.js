const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  // Detailed Preferences
  preferences: {
    // Content
    favoriteGenres: [String], // Simpan nama genre, bukan ID, agar lebih mudah dibaca
    maturityRating: { type: String, default: "Semua Umur" },

    // Display & Language
    subtitleLanguage: { type: String, default: "Bahasa Indonesia" },
    darkMode: { type: Boolean, default: true },
    autoplay: { type: Boolean, default: true },

    // Notifications
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      newReleases: { type: Boolean, default: true },
      recommendations: { type: Boolean, default: true },
    },
  },
  favoriteMovies: [{ type: Number }],
  watchlist: [{ type: Number }],
  profile: {
    avatar: String,
    bio: String,
    phone: String, // Tambahan
    location: String,
    birthDate: Date,
  },
  createdAt: { type: Date, default: Date.now },
});

// Tambahkan method untuk compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
