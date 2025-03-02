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
router.put("/profile", auth, async (req, res) => {
  try {
    const updates = {
      "profile.name": req.body.name,
      "profile.bio": req.body.bio,
      "profile.avatar": req.body.avatar,
      "profile.preferences": req.body.preferences,
    };

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true }
    ).select("-password");

    res.json({
      status: "success",
      message: "User profile updated successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
