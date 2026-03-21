function IntersectionPanel({ intersection, isSelected }) {
  const { id, lanes, decision, signal } = intersection;

  const remaining = signal?.remainingSeconds || 0;
  const mode = signal?.mode || "AUTO";

  return (
    <div className={`int-panel-card ${isSelected ? "selected" : ""}`}>
      <div className="int-panel-header">
        <h3 className="int-panel-title">🚦 {id}</h3>
        <span className={`int-mode-badge ${mode === "MANUAL" ? "manual" : "auto"}`}>
          {mode}
        </span>
      </div>

      <div className="int-panel-stats">
        <div className="int-panel-stat">
          <span className="int-stat-label">Active Lane</span>
          <span className="int-stat-value green-glow">{decision?.active_lane || "—"}</span>
        </div>
        <div className="int-panel-stat">
          <span className="int-stat-label">Reason</span>
          <span className="int-stat-value">{decision?.reason || "—"}</span>
        </div>
        <div className="int-panel-stat">
          <span className="int-stat-label">Time Left</span>
          <span className={`int-stat-value ${remaining <= 5 ? "urgent" : ""}`}>
            {remaining}s
          </span>
        </div>
      </div>

      <div className="int-panel-lanes">
        {lanes.map((lane, i) => (
          <div
            key={i}
            className={`int-lane-chip ${lane.lane === decision?.active_lane ? "active" : ""} ${lane.emergency ? "emergency" : ""}`}
          >
            <span className="lane-letter">{lane.lane}</span>
            <span className="lane-density">{lane.density}</span>
            {lane.emergency && <span className="lane-emg">🚨</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default IntersectionPanel;