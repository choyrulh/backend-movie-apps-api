const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");
const authController = require("../controllers/authController");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const auth = require("../middleware/auth.middleware");
const cookie = require("cookie");

// router.use(authMiddleware);
const router = express.Router();

// Konfigurasi cookie
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // Hanya HTTPS di production
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  maxAge: 24 * 60 * 60 * 1000, // 24 jam
};

// Helper untuk membuat token
const createToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });
};

// Register dengan validasi
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Invalid email").normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, email, password } = req.body;

      // Cek user existing
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          status: "error",
          message: "User already exists",
        });
      }

      // Buat user baru
      const user = new User({ name, email, password });
      await user.save();

      // Generate token
      const token = createToken(user._id);

      // Set cookie
      res.cookie("jwt", token, cookieOptions);

      res.status(201).json({
        status: "success",
        data: {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: "Internal server error",
      });
    }
  }
);

// Login dengan validasi
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Invalid email").normalizeEmail(),
    body("password").exists().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;

      // Cek user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "email not found",
        });
      }

      // Cek password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          status: "error",
          message: "password not match",
        });
      }

      // Generate token
      const token = createToken(user._id);

      // Set cookie
      res.cookie("jwt", token, cookieOptions);

      res.json({
        status: "success",
        token,
        data: {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: "Internal server error",
      });
    }
  }
);

// Logout
router.post("/logout", (req, res) => {
  try {
    // Clear cookie dengan options yang sama
    res.clearCookie("jwt", {
      ...cookieOptions,
      maxAge: 0, // Set expired
    });

    res.json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

module.exports = router;
