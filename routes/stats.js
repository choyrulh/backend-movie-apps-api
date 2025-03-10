const express = require("express");
const auth = require("../middleware/auth.middleware");
const RecentlyWatched = require("../models/RecentlyWatched");
const mongoose = require("mongoose");
const Favorites = require("../models/favorite.model");
const Watchlist = require("../models/watchlist.model");
// const { getISOWeek } = require("../lib/function");

const router = express.Router();

// GET: Watch Statistics
router.get("/", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { type } = req.query;
    const wibOffset = 7 * 60 * 60 * 1000; // WIB offset in milliseconds

    // Get current time in WIB and UTC
    const nowUTC = new Date();
    const nowWIB = new Date(nowUTC.getTime() + wibOffset);

    // Start of today in WIB (00:00:00)
    const startOfTodayWIB = new Date(nowWIB);
    startOfTodayWIB.setUTCHours(0, 0, 0, 0);

    // Convert back to UTC for database queries
    const startOfTodayUTC = new Date(startOfTodayWIB.getTime() - wibOffset);

    let startDate;
    let periodLabel;

    // Determine period based on type
    if (type === "week") {
      // Get start date for 7 days ago from today (including today)
      startDate = new Date(startOfTodayUTC.getTime() - 6 * 24 * 60 * 60 * 1000);
      endDate = nowUTC;
      periodLabel = "7 hari terakhir";
    } else if (type === "month") {
      // Get start date for 4 weeks ago from today (28 days including today)
      startDate = new Date(
        startOfTodayUTC.getTime() - 27 * 24 * 60 * 60 * 1000
      );
      endDate = nowUTC;
      periodLabel = "4 minggu terakhir";
    } else {
      return res.status(400).json({
        status: "error",
        message: "Invalid type parameter. Use 'week' or 'month'",
      });
    }

    // Get main statistics data
    // Di dalam route GET /stats
    const [
      totalWatched,
      totalCompletedMovies,
      totalCompletedTVContent,
      totalFavorites,
      totalWatchlist,
      totalInProgress,
    ] = await Promise.all([
      RecentlyWatched.countDocuments({ user: userId }),
      // Hitung movie yang selesai (progress >=90%)
      RecentlyWatched.countDocuments({
        user: userId,
        type: "movie",
        progressPercentage: { $gte: 90 },
        watchedDate: { $gte: startDate, $lte: endDate },
      }),

      // TV selesai (semua episode >=90% DAN total episode = totalEpisodes)
      RecentlyWatched.aggregate([
        {
          $match: {
            user: userId,
            type: "tv",
            watchedDate: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: "$contentId",
            episodesWatched: { $sum: 1 },
            minProgress: { $min: "$progressPercentage" },
            totalEpisodes: { $first: "$totalEpisodes" },
          },
        },
        {
          $match: {
            minProgress: { $gte: 90 },
            $expr: { $eq: ["$episodesWatched", "$totalEpisodes"] },
          },
        },
        { $count: "total" },
      ]),
      Favorites.countDocuments({ user: userId }),
      Watchlist.countDocuments({ user: userId }),
      RecentlyWatched.countDocuments({
        user: userId,
        progressPercentage: { $lt: 90, $gt: 0 },
      }),
    ]);

    // Total konten yang selesai = movie + TV
    const totalCompleted =
      totalCompletedMovies + (totalCompletedTVContent[0]?.total || 0);

    // Calculate total watch duration
    const totalDurationResult = await RecentlyWatched.aggregate([
      {
        $match: {
          user: userId,
          watchedDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$durationWatched" },
        },
      },
    ]);

    // Get most watched genres
    const mostWatchedGenres = await RecentlyWatched.aggregate([
      { $match: { user: userId } },
      { $unwind: "$genres" },
      { $group: { _id: "$genres", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, genre: "$_id", count: 1 } },
    ]);

    // Get content type distribution (movies vs TV shows)
    const contentTypeDistribution = await RecentlyWatched.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $project: { _id: 0, type: "$_id", count: 1 } },
    ]);

    // Get recent activity (10 most recent items)
    const recentActivity = await RecentlyWatched.aggregate([
      { $match: { user: userId } },
      { $sort: { watchedDate: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          title: 1,
          type: 1,
          contentId: 1,
          progressPercentage: 1,
          durationWatched: 1,
          totalDuration: 1,
          genres: 1,
          poster: 1,
          backdrop_path: 1,
          season: 1,
          episode: 1,
          watchedDate: {
            $dateToString: {
              format: "%Y-%m-%dT%H:%M:%S",
              date: { $add: ["$watchedDate", wibOffset] },
              timezone: "+07:00",
            },
          },
          formattedWatchedDate: {
            $dateToString: {
              format: "%d %b %Y, %H:%M",
              date: { $add: ["$watchedDate", wibOffset] },
              timezone: "+07:00",
            },
          },
        },
      },
    ]);

    // Generate day-by-day data for the selected period
    let periodData = [];

    if (type === "week") {
      // Generate array of the last 7 days (including today)
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const day = new Date(
          startOfTodayWIB.getTime() - i * 24 * 60 * 60 * 1000
        );
        days.push({
          date: day.toISOString().split("T")[0],
          dayOfWeek: day.toLocaleDateString("id-ID", { weekday: "short" }),
          dayOfMonth: day.getDate(),
          formattedDate: day.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          }),
        });
      }

      // Get watch data for each day
      const dayAggregation = await RecentlyWatched.aggregate([
        {
          $match: {
            user: userId,
            watchedDate: {
              $gte: startDate,
              $lte: nowWIB, // Tambahkan batas atas agar semua data yang sesuai rentang masuk
            },
          },
        },
        {
          $addFields: {
            wibDate: { $add: ["$watchedDate", wibOffset] },
            dateString: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: { $add: ["$watchedDate", wibOffset] },
                timezone: "+07:00",
              },
            },
          },
        },
        {
          $group: {
            _id: "$dateString",
            totalDuration: { $sum: "$durationWatched" },
            totalMovies: {
              $sum: { $cond: [{ $eq: ["$type", "movie"] }, 1, 0] },
            },
            totalTVEpisodes: {
              $sum: { $cond: [{ $eq: ["$type", "tv"] }, 1, 0] },
            },
            totalContent: { $sum: 1 },
            totalCompleted: {
              $sum: { $cond: [{ $gte: ["$progressPercentage", 90] }, 1, 0] },
            },
            items: {
              $push: {
                title: "$title",
                type: "$type",
                poster: "$poster",
                progressPercentage: "$progressPercentage",
              },
            },
          },
        },
      ]);

      // Merge data
      periodData = days.map((day) => {
        const dayData = dayAggregation.find((d) => d._id === day.date) || {};
        return {
          date: day.date,
          dayOfWeek: day.dayOfWeek,
          formattedDate: day.formattedDate,
          totalDuration: dayData.totalDuration || 0,
          totalMovies: dayData.totalMovies || 0,
          totalTVEpisodes: dayData.totalTVEpisodes || 0,
          totalContent: dayData.totalContent || 0,
          totalCompleted: dayData.totalCompleted || 0,
          completionRate: dayData.totalContent
            ? Math.round((dayData.totalCompleted / dayData.totalContent) * 100)
            : 0,
          hasActivity: !!dayData.totalContent,
          items: dayData.items || [],
        };
      });
    } else if (type === "month") {
      // Ambil 4 minggu terakhir dari hari ini
      const weeks = [];
      for (let i = 3; i >= 0; i--) {
        const startOfWeek = new Date(
          startOfTodayUTC.getTime() - i * 7 * 24 * 60 * 60 * 1000
        );
        const endOfWeek = new Date(
          startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000
        );

        weeks.push({
          weekNumber: 4 - i,
          startDate: startOfWeek.toISOString().split("T")[0],
          endDate: endOfWeek.toISOString().split("T")[0],
          label: `Minggu ${4 - i}`,
          formattedRange: `${startOfWeek.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          })} - ${endOfWeek.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          })}`,
          startDateObj: startOfWeek,
          endDateObj: endOfWeek,
        });
      }

      // Ubah rentang tanggal ke UTC agar sesuai dengan database
      const weekDateRanges = weeks.map((week) => ({
        weekNumber: week.weekNumber,
        startDate: new Date(week.startDateObj.getTime() - wibOffset),
        endDate: new Date(week.endDateObj.getTime() - wibOffset),
        label: week.label,
        formattedRange: week.formattedRange,
      }));

      // Perbaiki query aggregation agar datanya benar
      const weekData = await Promise.all(
        weekDateRanges.map(async (week) => {
          const data = await RecentlyWatched.aggregate([
            {
              $match: {
                user: userId,
                watchedDate: {
                  $gte: week.startDate,
                  $lte: new Date(week.endDate.setHours(23, 59, 59, 999)), // Pastikan endDate sampai akhir hari
                },
              },
            },
            {
              $group: {
                _id: null,
                totalDuration: { $sum: "$durationWatched" },
                totalMovies: {
                  $sum: { $cond: [{ $eq: ["$type", "movie"] }, 1, 0] },
                },
                totalTVEpisodes: {
                  $sum: { $cond: [{ $eq: ["$type", "tv"] }, 1, 0] },
                },
                totalContent: { $sum: 1 },
                totalCompleted: {
                  $sum: {
                    $cond: [{ $gte: ["$progressPercentage", 90] }, 1, 0],
                  },
                },
              },
            },
          ]);

          return {
            weekNumber: week.weekNumber,
            label: week.label,
            formattedRange: week.formattedRange,
            totalDuration: data[0]?.totalDuration || 0,
            totalMovies: data[0]?.totalMovies || 0,
            totalTVEpisodes: data[0]?.totalTVEpisodes || 0,
            totalContent: data[0]?.totalContent || 0,
            totalCompleted: data[0]?.totalCompleted || 0,
            completionRate: data[0]?.totalContent
              ? Math.round(
                  (data[0].totalCompleted / data[0].totalContent) * 100
                )
              : 0,
            hasActivity: !!data[0]?.totalContent,
          };
        })
      );

      periodData = weekData;
    }

    // Get activity for the whole period
    const periodActivitySummary = await RecentlyWatched.aggregate([
      {
        $match: {
          user: userId,
          watchedDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalDuration: { $sum: "$durationWatched" },
          totalMovies: { $sum: { $cond: [{ $eq: ["$type", "movie"] }, 1, 0] } },
          totalTVEpisodes: {
            $sum: { $cond: [{ $eq: ["$type", "tv"] }, 1, 0] },
          },
          totalContent: { $sum: 1 },
          totalCompleted: {
            $sum: { $cond: [{ $gte: ["$progressPercentage", 90] }, 1, 0] },
          },
          avgProgressPercentage: { $avg: "$progressPercentage" },
        },
      },
      {
        $project: {
          _id: 0,
          totalDuration: 1,
          totalMovies: 1,
          totalTVEpisodes: 1,
          totalContent: 1,
          totalCompleted: 1,
          completionRate: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      "$totalCompleted",
                      { $max: ["$totalContent", 1] },
                    ],
                  },
                  100,
                ],
              },
              1,
            ],
          },
          avgProgressPercentage: { $round: ["$avgProgressPercentage", 1] },
        },
      },
    ]);

    // Get top genres for the period
    const periodTopGenres = await RecentlyWatched.aggregate([
      {
        $match: {
          user: userId,
          watchedDate: { $gte: startDate, $lte: endDate },
        },
      },
      { $unwind: "$genres" },
      {
        $group: {
          _id: "$genres",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, genre: "$_id", count: 1 } },
    ]);

    // Calculate watch time metrics
    const totalPeriodWatchTime = periodActivitySummary[0]?.totalDuration || 0;
    const formattedTotalWatchTime = formatWatchTime(
      totalDurationResult[0]?.total || 0
    );
    const formattedPeriodWatchTime = formatWatchTime(totalPeriodWatchTime);
    const daysInPeriod = type === "week" ? 7 : 28;
    // Calculate watch time per day average for the period
    const avgWatchTimePerDay = Math.round(totalPeriodWatchTime / daysInPeriod);

    const formattedAvgWatchTime = formatWatchTime(avgWatchTimePerDay);

    // Get favorite watch times for the period (morning, afternoon, evening, night)
    const favoriteWatchTimes = await RecentlyWatched.aggregate([
      {
        $match: {
          user: userId,
          watchedDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $addFields: {
          hourWIB: {
            $hour: { $add: ["$watchedDate", wibOffset] },
          },
          timeOfDay: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [
                      {
                        $gte: [
                          { $hour: { $add: ["$watchedDate", wibOffset] } },
                          5,
                        ],
                      },
                      {
                        $lt: [
                          { $hour: { $add: ["$watchedDate", wibOffset] } },
                          10,
                        ],
                      },
                    ],
                  },
                  then: "Pagi",
                },
                {
                  case: {
                    $and: [
                      {
                        $gte: [
                          { $hour: { $add: ["$watchedDate", wibOffset] } },
                          10,
                        ],
                      },
                      {
                        $lt: [
                          { $hour: { $add: ["$watchedDate", wibOffset] } },
                          15,
                        ],
                      },
                    ],
                  },
                  then: "Siang",
                },
                {
                  case: {
                    $and: [
                      {
                        $gte: [
                          { $hour: { $add: ["$watchedDate", wibOffset] } },
                          15,
                        ],
                      },
                      {
                        $lt: [
                          { $hour: { $add: ["$watchedDate", wibOffset] } },
                          19,
                        ],
                      },
                    ],
                  },
                  then: "Sore",
                },
                {
                  case: {
                    $or: [
                      {
                        $gte: [
                          { $hour: { $add: ["$watchedDate", wibOffset] } },
                          19,
                        ],
                      },
                      {
                        $lt: [
                          { $hour: { $add: ["$watchedDate", wibOffset] } },
                          5,
                        ],
                      },
                    ],
                  },
                  then: "Malam",
                },
              ],
              default: "Lainnya",
            },
          },
        },
      },
      { $group: { _id: "$timeOfDay", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, timeOfDay: "$_id", count: 1 } },
    ]);

    res.json({
      status: "success",
      message: "Statistik berhasil didapatkan",
      data: {
        // Overall statistics
        overall: {
          totalContentWatched: totalWatched,
          totalCompletedContent: totalCompleted,
          totalInProgress,
          totalFavorites,
          totalWatchlist,
          totalWatchTime: totalDurationResult[0]?.total || 0,
          formattedWatchTime: formattedTotalWatchTime,
          mostWatchedGenres,
          contentTypeDistribution,
        },

        // Period statistics
        period: {
          type,
          label: periodLabel,
          startDate: startDate.toISOString(),
          endDate: nowWIB.toISOString(),
          summary: {
            ...(periodActivitySummary[0] || {
              totalDuration: 0,
              totalMovies: 0,
              totalTVEpisodes: 0,
              totalContent: 0,
              totalCompleted: 0,
              completionRate: 0,
              avgProgressPercentage: 0,
            }),
            formattedWatchTime: formattedPeriodWatchTime,
            averageWatchTimePerDay: formattedAvgWatchTime,
            topGenres: periodTopGenres,
            favoriteWatchTimes,
          },
          data: periodData,
        },

        // Recent activity
        recentActivity,
      },
      timezone: "UTC+7",
      lastUpdated: new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      status: "error",
      message: "Kesalahan server internal",
    });
  }
});

// Helper function to format watch time from seconds
function formatWatchTime(seconds) {
  if (!seconds) return "0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

module.exports = router;
