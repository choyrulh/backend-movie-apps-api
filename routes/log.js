// backend/routes/logs.js
const express = require("express");
const router = express.Router();
const UAparser = require("ua-parser-js");
const AccessLog = require("../models/accessLog.model");

// Jika kamu pakai Node.js >=18, fetch sudah langsung tersedia, jadi tidak perlu import apa-apa.


router.post("/", async (req, res) => {
  try {
    const userAgent = req.headers["user-agent"];
    const parser = new UAparser(userAgent);
    const device = parser.getResult();

    // Dapatkan IP address yang benar dari header Vercel
    const ip =
      req.headers["x-real-ip"] ||
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    // Cek jika IP adalah localhost
    let location = {};
    if (!ip.match(/^(::1|127\.0\.0\.1|localhost)$/)) {
      try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);

        // Cek status response sebelum parse JSON
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        location = await response.json();
      } catch (error) {
        console.error("Error fetching location:", error);
        location = {
          country_name: "Unknown",
          region: "Unknown",
          city: "Unknown",
        };
      }
    } else {
      location = {
        country_name: "Localhost",
        region: "Local Network",
        city: "Localhost",
      };
    }

    const log = new AccessLog({
      ip,
      deviceType: device.device?.type || "desktop",
      browser: device.browser?.name || "Unknown Browser",
      os: device.os?.name || "Unknown OS",
      country: location.country_name,
      region: location.region,
      city: location.city,
    });

    await log.save();
    res.status(201).send(log);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error: " + error.message);
  }
});

router.get("/", async (req, res) => {
  try {
    const logs = await AccessLog.find().sort({ timestamp: -1 });
    res.json({
      status: 200,
      logs: logs,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error: " + error.message);
  }
});

module.exports = router;

router.get("/", async (req, res) => {
  try {
    const logs = await AccessLog.find().sort({ timestamp: -1 });
    res.json({
      status: 200,
      logs: logs,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

module.exports = router;
