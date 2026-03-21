const express = require("express");
const router = express.Router();

const {
    uploadVideo,
    getVideosByIntersection,
    getLatestByIntersection,
    getVideoStatus,
    streamVideo
} = require("../controllers/video.controller");

// Upload video for a specific lane/intersection
router.post("/upload", uploadVideo);

// Get all videos for an intersection
router.get("/intersection/:id", getVideosByIntersection);

// Get latest video per lane for an intersection
router.get("/latest/:intersection_id", getLatestByIntersection);

// Get processing status of a video
router.get("/status/:id", getVideoStatus);

// Stream video file from GridFS
router.get("/stream/:id", streamVideo);

module.exports = router;
