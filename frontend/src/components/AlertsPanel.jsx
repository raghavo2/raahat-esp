function AlertsPanel({ alerts }) {
  return (
    <div style={{ maxHeight: "300px", overflowY: "auto" }}>
      {alerts.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: "12px", textAlign: "center" }}>No activity yet</p>
      ) : (
        <div className="alert-list">
          {alerts.map((a, i) => (
            <div key={i} className={`alert-item ${a.type || ""}`}>
              <span className="alert-time">{a.time}</span>
              {a.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AlertsPanel;