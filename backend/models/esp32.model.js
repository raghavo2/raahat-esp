const mongoose = require("mongoose");

const ESP32Schema = new mongoose.Schema({
    device_id: {
        type: String,
        required: true,
        unique: true
    },
    intersection_id: {
        type: String,
        required: true
    },
    ip: {
        type: String,
        default: null
    },
    lastSeen: {
        type: Date,
        default: Date.now
    }
});

/**
 * Virtual: device is "online" if lastSeen < 30 seconds ago
 */
ESP32Schema.virtual("status").get(function () {
    const thirtySecondsAgo = Date.now() - 30 * 1000;
    return this.lastSeen >= thirtySecondsAgo ? "online" : "offline";
});

// Include virtuals in JSON output
ESP32Schema.set("toJSON", { virtuals: true });
ESP32Schema.set("toObject", { virtuals: true });

module.exports = mongoose.model("ESP32Device", ESP32Schema);
