let currentSignal = {
    active_lane: null,
    endsAt: null,
    mode: "AUTO", // AUTO | MANUAL
    reason: null,
    duration: 0
};

/**
 * Force-override the current signal immediately, regardless of remaining time.
 * Used by emergency detection and high-congestion scenarios.
 */
function forceOverride(decision) {
    currentSignal = {
        active_lane: decision.active_lane,
        endsAt: Date.now() + decision.duration * 1000,
        mode: "AUTO",
        reason: decision.reason,
        duration: decision.duration
    };
    return getSignalState();
}

/**
 * Update signal based on AI decision.
 * Rules:
 *   1. Emergency ALWAYS overrides (even manual mode)
 *   2. High congestion overrides if >50% of current timer has elapsed (unless emergency is active)
 *   3. Otherwise, respect the current timer — don't change until it expires
 *   4. When timer expires, apply the new decision normally
 */
function updateSignal(decision) {
    const now = Date.now();

    // 🚨 Emergency ALWAYS overrides — even manual mode
    if (decision.reason === "emergency vehicle") {
        return forceOverride(decision);
    }

    // 🚫 If current signal is emergency, nothing except another emergency can override
    if (currentSignal.reason === "emergency vehicle" && currentSignal.endsAt && now < currentSignal.endsAt) {
        return getSignalState();
    }

    // 📊 High congestion override — only if >50% of current timer elapsed
    if (decision.reason === "high traffic" && currentSignal.endsAt && now < currentSignal.endsAt) {
        const signalStartedAt = currentSignal.endsAt - (currentSignal.duration * 1000);
        const elapsed = now - signalStartedAt;
        const halfDuration = (currentSignal.duration * 1000) / 2;

        if (elapsed > halfDuration) {
            return forceOverride(decision);
        }
    }

    // ⏱️ Normal: if current signal still running → do nothing, return remaining time
    if (currentSignal.endsAt && now < currentSignal.endsAt) {
        return getSignalState();
    }

    // ✅ Timer expired or no active signal → apply new decision
    currentSignal = {
        active_lane: decision.active_lane,
        endsAt: now + decision.duration * 1000,
        mode: "AUTO",
        reason: decision.reason,
        duration: decision.duration
    };

    return getSignalState();
}

/**
 * Manual override by operator.
 * Sets a specific lane green for a given duration.
 * Can still be interrupted by emergency signals.
 */
function manualOverride(lane, duration) {
    currentSignal = {
        active_lane: lane,
        endsAt: Date.now() + duration * 1000,
        mode: "MANUAL",
        reason: "manual override",
        duration: duration
    };

    return getSignalState();
}

/**
 * Get the full signal state including computed remaining seconds.
 */
function getSignalState() {
    const now = Date.now();
    let remainingSeconds = 0;
    let isExpired = true;

    if (currentSignal.endsAt) {
        const remaining = currentSignal.endsAt - now;
        if (remaining > 0) {
            remainingSeconds = Math.ceil(remaining / 1000);
            isExpired = false;
        }
    }

    return {
        active_lane: currentSignal.active_lane,
        mode: currentSignal.mode,
        reason: currentSignal.reason,
        duration: currentSignal.duration,
        remainingSeconds,
        isExpired,
        endsAt: currentSignal.endsAt
    };
}

function getCurrentSignal() {
    return getSignalState();
}

module.exports = {
    updateSignal,
    manualOverride,
    getCurrentSignal,
    getSignalState,
    forceOverride
};