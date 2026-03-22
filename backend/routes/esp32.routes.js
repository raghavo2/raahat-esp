const express = require("express");
const router = express.Router();

const {
    getSignalForESP32,
    heartbeat,
    getDevices
} = require("../controllers/esp32.controller");

// ESP32 polls this every ~1s to get current signal state
router.get("/signal/:intersection_id", getSignalForESP32);

// ESP32 sends heartbeat every ~10s for device tracking
router.post("/heartbeat", heartbeat);

// Frontend fetches this to show device status on dashboard
router.get("/devices", getDevices);

module.exports = router;
