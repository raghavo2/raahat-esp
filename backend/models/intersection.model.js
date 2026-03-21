const mongoose = require("mongoose");

const IntersectionSchema = new mongoose.Schema({
    intersection_id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    lanes: {
        type: [String],
        required: true,
        default: ["A", "B", "C", "D"]
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Intersection", IntersectionSchema);
