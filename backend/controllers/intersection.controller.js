const Intersection = require("../models/intersection.model");

/**
 * Register a new intersection
 * POST /intersections
 * Body: { intersection_id, name, location: { lat, lng }, lanes: ["A","B","C","D"] }
 */
exports.createIntersection = async (req, res) => {
    try {
        const { intersection_id, name, location, lanes } = req.body;

        if (!intersection_id || !name || !location) {
            return res.status(400).json({
                error: "intersection_id, name, and location (lat, lng) are required"
            });
        }

        // Check if already exists
        const existing = await Intersection.findOne({ intersection_id });
        if (existing) {
            return res.status(409).json({ error: "Intersection already exists", data: existing });
        }

        const intersection = await Intersection.create({
            intersection_id,
            name,
            location,
            lanes: lanes || ["A", "B", "C", "D"]
        });

        console.log("✅ Intersection registered:", intersection_id);
        res.status(201).json(intersection);
    } catch (err) {
        console.error("Error creating intersection:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get all registered intersections
 * GET /intersections
 */
exports.getAllIntersections = async (req, res) => {
    try {
        const intersections = await Intersection.find().sort({ createdAt: -1 });
        res.json(intersections);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get a single intersection by ID
 * GET /intersections/:id
 */
exports.getIntersection = async (req, res) => {
    try {
        const intersection = await Intersection.findOne({
            intersection_id: req.params.id
        });

        if (!intersection) {
            return res.status(404).json({ error: "Intersection not found" });
        }

        res.json(intersection);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
