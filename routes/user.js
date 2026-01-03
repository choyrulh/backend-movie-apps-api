const router = require("express").Router();
const authMiddleware = require("../middleware/auth");
const User = require("../models/User");
const auth = require("../middleware/auth.middleware");

router.use(authMiddleware);

// Get user profile
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    res.json({
      status: "success",
      message: "User profile retrieved successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Update user profile
// 2. Update General Profile & Preferences
router.put("/profile", auth, async (req, res) => {
  try {
    const { name, profile, preferences } = req.body;

    // Menyiapkan objek update dengan dot notation untuk nested object
    const updateData = {};

    // Root fields
    if (name) updateData.name = name;

    // Profile fields (Nested)
    if (profile) {
      if (profile.bio !== undefined) updateData["profile.bio"] = profile.bio;
      if (profile.avatar !== undefined) updateData["profile.avatar"] = profile.avatar;
      if (profile.phone !== undefined) updateData["profile.phone"] = profile.phone;
      if (profile.location !== undefined) updateData["profile.location"] = profile.location;
    }

    // Preferences fields (Nested)
    if (preferences) {
      if (preferences.favoriteGenres) updateData["preferences.favoriteGenres"] = preferences.favoriteGenres;
      if (preferences.maturityRating) updateData["preferences.maturityRating"] = preferences.maturityRating;
      if (preferences.language) updateData["preferences.language"] = preferences.language;
      if (preferences.subtitleLanguage) updateData["preferences.subtitleLanguage"] = preferences.subtitleLanguage;
      if (preferences.darkMode !== undefined) updateData["preferences.darkMode"] = preferences.darkMode;
      if (preferences.autoplay !== undefined) updateData["preferences.autoplay"] = preferences.autoplay;

      // Notifications (Double Nested)
      if (preferences.notifications) {
        const notes = preferences.notifications;
        if (notes.email !== undefined) updateData["preferences.notifications.email"] = notes.email;
        if (notes.push !== undefined) updateData["preferences.notifications.push"] = notes.push;
        if (notes.newReleases !== undefined) updateData["preferences.notifications.newReleases"] = notes.newReleases;
        if (notes.recommendations !== undefined) updateData["preferences.notifications.recommendations"] = notes.recommendations;
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json({
      status: "success",
      message: "Profil berhasil diperbarui",
      data: user,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: "Gagal memperbarui profil", error: error.message });
  }
});

module.exports = router;
