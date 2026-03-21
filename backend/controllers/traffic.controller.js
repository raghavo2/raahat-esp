const { decideSignal } = require("../services/decision.service");
const Traffic = require("../models/traffic.model");
const {
    updateSignal,
    manualOverride,
    getCurrentSignal,
    getSignalState
} = require("../services/signal.controller");

let currentState = { intersections: [] };

exports.analyzeTraffic = async (req, res) => {
    const { intersections } = req.body;

    if (!intersections) {
        return res.status(400).json({ error: "Intersections required" });
    }

    // 🧠 Decision per intersection
    const result = intersections.map(int => {
        const decision = decideSignal(int.lanes);
        const signal = updateSignal(decision);

        return {
            ...int,
            decision,
            signal
        };
    });

    currentState = { intersections: result };

    await Traffic.create(currentState);

    console.log("Updated State:", JSON.stringify(currentState, null, 2));

    res.json(currentState);
};

exports.getHistory = async (req, res) => {
    const data = await Traffic.find().sort({ createdAt: -1 }).limit(10);
    res.json(data);
};

exports.getCurrent = (req, res) => {
    // Attach current signal state to response
    const signalState = getSignalState();
    res.json({
        ...currentState,
        signalState
    });
};

exports.manualControl = (req, res) => {
    const { lane, duration } = req.body;

    if (!lane || !duration) {
        return res.status(400).json({ error: "Lane and duration required" });
    }

    const signal = manualOverride(lane, duration);
    res.json(signal);
};

exports.getSignalStatus = (req, res) => {
    res.json(getSignalState());
};