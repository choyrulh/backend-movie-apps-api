const mongoose = require("mongoose");

const accessLogSchema = new mongoose.Schema({
  ip: String,
  deviceType: String,
  browser: String,
  os: String,
  country: String,
  region: String,
  city: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AccessLog", accessLogSchema);
