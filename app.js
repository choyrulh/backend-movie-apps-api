require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const authRoutes = require("./routes/auth");
const recentlyWatchedRoutes = require("./routes/recentlyWatched");
const userRoutes = require("./routes/user");
const statsRoutes = require("./routes/stats");
const favoriteRoutes = require("./routes/favorites");
const watchlistRoutes = require("./routes/watchlist");
const statisticsRoutes = require("./routes/stats");
const morgan = require("morgan");
const helmet = require("helmet");
const xss = require("xss-clean");
const app = express();
const logRoutes = require("./routes/log");

// Middleware
app.use(express.json());

// Global Middleware
// Set security HTTP headers
app.use(helmet());

app.use(mongoSanitize());
const limiter = rateLimit({
  max: 100, // Maksimal 100 request
  windowMs: 60 * 60 * 1000, // Per 1 jam (dalam milidetik)
  message: "Terlalu banyak request dari IP ini, silakan coba lagi dalam satu jam!",
  standardHeaders: true, // Sertakan info rate limit di header `RateLimit-*`
  legacyHeaders: false, // Matikan header `X-RateLimit-*` yang lama
});
app.use("/api", limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

app.use("/api/auth", authLimiter);

// Dev logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Body Parser Middleware
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// Data sanitization against XSS
app.use(xss());

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://movie-apps-with-next15.vercel.app",
      "https://lacak-lokasi.vercel.app/",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// Database connection
// mongoose
//   .connect(process.env.DATABASE, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     dbName: "MovieApps",
//   })
//   .then(() => console.log("Connected to MongoDB"))
//   .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/recently-watched", recentlyWatchedRoutes);
app.use("/api/user", userRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/logs", logRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong "});
});

// const PORT = process.env.PORT || 3100;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
