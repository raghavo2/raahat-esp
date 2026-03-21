import { useEffect, useState } from "react";
import axios from "axios";
import "./dashboard.css";
import Intersection from "../components/Intersection";
import DecisionPanel from "../components/DecisionPanel";
import AlertsPanel from "../components/AlertsPanel";
import MapView from "../components/MapView";
import IntersectionPanel from "../components/IntersectionPanel";
import ManualControlPanel from "../components/ManualControlPanel";
import VideoFeedPanel from "../components/VideoFeedPanel";
import VideoUploadPanel from "../components/VideoUploadPanel";


function Dashboard() {
  const [data, setData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [selectedIntersection, setSelectedIntersection] = useState(null);

  const isEmergency = data.intersections?.some(int =>
    int.lanes?.some(l => l.emergency)
  );

  // Set first intersection as selected when data arrives
  useEffect(() => {
    if (data.intersections?.length > 0 && !selectedIntersection) {
      setSelectedIntersection(data.intersections[0].id);
    }
  }, [data.intersections]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get("http://localhost:3000/traffic/current");
        setData(res.data);

        // Emergency alert
        if (res.data.intersections?.some(int =>
          int.lanes?.some(l => l.emergency)
        )) {
          setAlerts(prev => [
            {
              message: "🚨 Emergency vehicle detected!",
              time: new Date().toLocaleTimeString(),
              type: "emergency"
            },
            ...prev.slice(0, 19)
          ]);
        }

        // Signal change alert
        const signalState = res.data.signalState;
        if (signalState?.active_lane) {
          setAlerts(prev => {
            if (prev[0]?.message === `Lane ${signalState.active_lane} → GREEN (${signalState.mode})`) {
              return prev;
            }
            return [
              {
                message: `Lane ${signalState.active_lane} → GREEN (${signalState.mode})`,
                time: new Date().toLocaleTimeString(),
                type: signalState.mode === "MANUAL" ? "manual" : "info"
              },
              ...prev.slice(0, 19)
            ];
          });
        }

      } catch (err) {
        console.error("Error fetching data:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!data || !data.intersections) return <p style={{ color: "#64748b", padding: "40px", textAlign: "center" }}>Loading dashboard...</p>;

  return (
    <div className={`dashboard ${isEmergency ? "emergency" : ""}`}>

      {/* LEFT PANEL */}
      <div className="panel left">
        <h2>🚦 Intersections</h2>

        {data.intersections.map((int) => (
          <div
            key={int.id}
            onClick={() => setSelectedIntersection(int.id)}
            style={{ cursor: "pointer" }}
          >
            <IntersectionPanel
              intersection={int}
              isSelected={selectedIntersection === int.id}
            />
          </div>
        ))}
      </div>

      {/* CENTER PANEL */}
      <div className="panel center">

        <MapView data={data} />

        {/* 4-Lane Video Feed Grid — under the map */}
        <VideoFeedPanel intersectionId={selectedIntersection} />

      </div>

      {/* RIGHT PANEL */}
      <div className="panel right">
        <h2>🎛️ Control Center</h2>

        <ManualControlPanel />

        {/* Video Upload */}
        <div style={{ marginTop: "16px" }}>
          <VideoUploadPanel />
        </div>

        <div style={{ marginTop: "16px" }}>
          <h3 style={{ color: "#38bdf8", marginBottom: "8px", fontSize: "14px" }}>📋 Activity Log</h3>
          <AlertsPanel alerts={alerts} />
        </div>
      </div>

    </div>
  );
}

export default Dashboard;