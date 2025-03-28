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

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Fetch location menggunakan fetch native
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    const location = await response.json();

    const log = new AccessLog({
      ip,
      deviceType: device.device.type || "desktop",
      browser: device.browser.name,
      os: device.os.name,
      country: location.country_name,
      region: location.region,
      city: location.city,
    });

    await log.save();
    res.status(201).send(log);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
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
    res.status(500).send("Server error");
  }
});

module.exports = router;
