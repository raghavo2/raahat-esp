/**
 * model.service.js — AI Model Abstraction Layer
 * 
 * ═══════════════════════════════════════════════════════════════
 * This is the ONLY file your teammate needs to modify when the
 * trained .pkl model is ready.
 * ═══════════════════════════════════════════════════════════════
 * 
 * HOW TO PLUG IN THE .pkl MODEL:
 * 
 * 1. Place the .pkl file in:  backend/model/traffic_model.pkl
 * 2. Install Python dependencies: pip install flask pickle5 opencv-python
 * 3. Start the Python prediction server: python backend/scripts/predict_server.py
 * 4. Flip USE_REAL_MODEL to true below
 * 
 * The predict_server.py loads the .pkl file and exposes a REST API.
 * This service calls that API. Everything else stays the same.
 */

const axios = require("axios");

// ══════════════════ CONFIG ══════════════════
const USE_REAL_MODEL = false;
const MODEL_API_URL = "http://localhost:5000/predict";
// ════════════════════════════════════════════

/**
 * Analyze a video and return traffic data for that lane.
 * 
 * @param {string} videoPath   - Path or identifier of the video
 * @param {string} intersectionId  - Intersection this video belongs to
 * @param {string} laneId     - Lane this video belongs to
 * @returns {Promise<Object>}  - { vehicle_count, avg_speed, density, emergency }
 */
async function analyzeVideo(videoPath, intersectionId, laneId) {
    if (USE_REAL_MODEL) {
        return await callRealModel(videoPath, intersectionId, laneId);
    } else {
        return mockAnalysis(laneId);
    }
}

/**
 * REAL MODEL — Calls the Python prediction server that loads the .pkl file.
 * Your teammate sets this up with predict_server.py
 */
async function callRealModel(videoPath, intersectionId, laneId) {
    try {
        const response = await axios.post(MODEL_API_URL, {
            video_path: videoPath,
            intersection_id: intersectionId,
            lane_id: laneId
        });

        // Expected response format from Python:
        // { vehicle_count: 23, avg_speed: 35, density: "high", emergency: false }
        return response.data;
    } catch (err) {
        console.error(`Model API error for ${intersectionId}/${laneId}:`, err.message);
        throw new Error(`Model prediction failed: ${err.message}`);
    }
}

/**
 * MOCK MODEL — Returns random but realistic traffic data.
 * Used until the real .pkl model is ready.
 */
function mockAnalysis(laneId) {
    const densities = ["low", "medium", "high"];
    const vehicleCount = Math.floor(Math.random() * 50);
    const avgSpeed = Math.floor(Math.random() * 60) + 5;

    let density;
    if (vehicleCount > 35) density = "high";
    else if (vehicleCount > 15) density = "medium";
    else density = "low";

    return {
        vehicle_count: vehicleCount,
        avg_speed: avgSpeed,
        density,
        emergency: Math.random() < 0.05 // 5% chance
    };
}

module.exports = { analyzeVideo };
