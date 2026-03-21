import { useState, useEffect } from "react";
import axios from "axios";

function VideoUploadPanel() {
  const [intersections, setIntersections] = useState([]);
  const [selectedInt, setSelectedInt] = useState("");
  const [selectedLane, setSelectedLane] = useState("");
  const [availableLanes, setAvailableLanes] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Fetch registered intersections
  useEffect(() => {
    axios.get("http://localhost:3000/intersections")
      .then(res => {
        setIntersections(res.data);
        if (res.data.length > 0) {
          setSelectedInt(res.data[0].intersection_id);
          setAvailableLanes(res.data[0].lanes);
          setSelectedLane(res.data[0].lanes[0]);
        }
      })
      .catch(() => {});
  }, []);

  // Update available lanes when intersection changes
  useEffect(() => {
    const int = intersections.find(i => i.intersection_id === selectedInt);
    if (int) {
      setAvailableLanes(int.lanes);
      setSelectedLane(int.lanes[0]);
    }
  }, [selectedInt, intersections]);

  const handleUpload = async () => {
    if (!file || !selectedInt || !selectedLane) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("intersection_id", selectedInt);
    formData.append("lane_id", selectedLane);

    try {
      const res = await axios.post("http://localhost:3000/video/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setUploadResult({ type: "success", message: `✅ Uploaded! Processing started.` });
      setFile(null);
    } catch (err) {
      setUploadResult({
        type: "error",
        message: `❌ ${err.response?.data?.error || err.message}`
      });
    }
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("video/")) {
      setFile(droppedFile);
    }
  };

  return (
    <div className="video-upload-panel">
      <h4 className="upload-title">📹 Upload Lane Video</h4>

      {intersections.length === 0 ? (
        <p className="upload-note">No intersections registered. Register one first via API.</p>
      ) : (
        <>
          <div className="upload-field">
            <label className="upload-label">Intersection</label>
            <select
              className="upload-select"
              value={selectedInt}
              onChange={e => setSelectedInt(e.target.value)}
            >
              {intersections.map(int => (
                <option key={int.intersection_id} value={int.intersection_id}>
                  {int.name} ({int.intersection_id})
                </option>
              ))}
            </select>
          </div>

          <div className="upload-field">
            <label className="upload-label">Lane</label>
            <div className="lane-selector">
              {availableLanes.map(l => (
                <button
                  key={l}
                  className={`lane-btn ${selectedLane === l ? "selected" : ""}`}
                  onClick={() => setSelectedLane(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={`drop-zone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("video-file-input").click()}
          >
            <input
              id="video-file-input"
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={e => setFile(e.target.files[0])}
            />
            {file ? (
              <div className="file-info">
                <span className="file-icon">🎬</span>
                <span className="file-name">{file.name}</span>
                <span className="file-size">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
            ) : (
              <div className="drop-placeholder">
                <span className="drop-icon">📂</span>
                <span>Drop video here or click to browse</span>
              </div>
            )}
          </div>

          <button
            className="upload-btn"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? "⏳ Uploading..." : "🚀 Upload & Analyze"}
          </button>

          {uploadResult && (
            <div className={`upload-result ${uploadResult.type}`}>
              {uploadResult.message}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default VideoUploadPanel;
