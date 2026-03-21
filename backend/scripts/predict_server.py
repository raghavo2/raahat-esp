"""
predict_server.py — Python Prediction Server for Traffic Model

This script loads the trained .pkl model and exposes a REST API.
The Node.js backend calls this API to get predictions.

SETUP:
    1. Place your trained model at: backend/model/traffic_model.pkl
    2. Install dependencies: pip install flask opencv-python numpy
    3. Run: python scripts/predict_server.py

The server will start at http://localhost:5000

API:
    POST /predict
    Body: { "video_path": "...", "intersection_id": "...", "lane_id": "..." }
    Response: { "vehicle_count": 23, "avg_speed": 35, "density": "high", "emergency": false }
"""

import os
import pickle
import json
from flask import Flask, request, jsonify

app = Flask(__name__)

# ══════════ LOAD MODEL ══════════
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "model", "traffic_model.pkl")

model = None

def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        print(f"✅ Model loaded from: {MODEL_PATH}")
    else:
        print(f"⚠️  Model not found at: {MODEL_PATH}")
        print("    Server will return mock predictions until model is placed there.")

# ══════════ PREDICTION ENDPOINT ══════════
@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    video_path = data.get("video_path")
    intersection_id = data.get("intersection_id")
    lane_id = data.get("lane_id")

    if not video_path or not intersection_id or not lane_id:
        return jsonify({"error": "video_path, intersection_id, and lane_id are required"}), 400

    if model is not None:
        # ════════════════════════════════════════════
        # YOUR TEAMMATE MODIFIES THIS SECTION
        # Replace with actual model inference logic:
        #
        #   - Read the video using OpenCV
        #   - Extract frames / features
        #   - Run model.predict(features)
        #   - Map output to the response format
        #
        # Example:
        #   import cv2
        #   cap = cv2.VideoCapture(video_path)
        #   features = extract_features(cap)
        #   prediction = model.predict(features)
        #   result = map_prediction_to_response(prediction)
        # ════════════════════════════════════════════

        result = {
            "vehicle_count": 0,
            "avg_speed": 0,
            "density": "low",
            "emergency": False
        }
    else:
        # Mock prediction when model not loaded
        import random
        vc = random.randint(0, 50)
        result = {
            "vehicle_count": vc,
            "avg_speed": random.randint(5, 60),
            "density": "high" if vc > 35 else ("medium" if vc > 15 else "low"),
            "emergency": random.random() < 0.05
        }

    return jsonify(result)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None
    })


if __name__ == "__main__":
    load_model()
    print("🚀 Prediction server starting on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
