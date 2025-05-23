const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { body, validationResult } = require("express-validator");

// router.use(authMiddleware);
const router = express.Router();

// Konfigurasi cookie
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // Hanya HTTPS di production
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 1 minggu
};

// Helper untuk membuat token
const createToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "168h", // 1 minggu
  });
};

// Helper untuk mengirim response error
const sendErrorResponse = (res, statusCode, message) => {
  return res.status(statusCode).json({
    status: "error",
    message: message,
  });
};

// Register dengan validasi
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required").escape(),
    body("email").isEmail().withMessage("Invalid email").normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
      .withMessage(
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    try {
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: "error",
          message: errors.array()[0].msg,
        });
      }

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
        message: "User successfully created",
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
      // Handle MongoDB duplicate key error
      if (error.code === 11000) {
        return res.status(409).json({
          status: "error",
          message: "Email already registered",
          errors: [{ field: "email", message: "Email already registered" }],
        });
      }

      console.error("Registration Error:", error);
      sendErrorResponse(res, 500, "Registration failed");
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
    try {
      // Validasi input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          status: "error",
          message: "Please provide email and password",
        });
      }

      // Cek user exists dan password match dengan method comparePassword di model User
      const user = await User.findOne({ email }).select("+password");
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
        message: "Login success",
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
      console.error("Login Error:", error);
      sendErrorResponse(res, 500, "Internal server error");
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
