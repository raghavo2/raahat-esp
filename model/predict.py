import os
import tempfile
import time
from typing import Optional

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# 🔥 IMPORT YOUR FUNCTIONS
from predict_video import raahat_predict_video
from predict_audio import raahat_predict_audio


# ══════════ CONFIG ══════════
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")
MODEL_PORT = int(os.environ.get("MODEL_PORT", 8000))

DEBUG_VIDEO_DIR = "debug_videos"
os.makedirs(DEBUG_VIDEO_DIR, exist_ok=True)
# ════════════════════════════


app = FastAPI(
    title="Raahat Traffic AI Server",
    version="4.0.0",
)


# ══════════ REQUEST MODEL ══════════

class PredictRequest(BaseModel):
    video_path: str
    intersection_id: str
    lane_id: str
    line_type: Optional[str] = None


# ══════════ RESPONSE MODEL ══════════

class PredictResponse(BaseModel):
    line: str
    vehicle_count: int
    density: str
    avg_speed: float
    emergency: bool
    audio_used: bool

    # 🔥 Fusion outputs
    video_score: float
    audio_score: float
    final_score: float


# ══════════ HEALTH CHECK ══════════

@app.get("/health")
async def health():
    return {"status": "ok"}


# ══════════ MAIN API ══════════

@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):

    stream_url = f"{BACKEND_URL}/video/stream/{req.video_path}"
    tmp_video_path = None

    try:
        # ── 1. DOWNLOAD VIDEO ──
        print(f"📥 Downloading video from {stream_url}")

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(stream_url)

        if response.status_code != 200:
            raise HTTPException(status_code=502, detail="Video download failed")

        tmp_fd, tmp_video_path = tempfile.mkstemp(suffix=".mp4")
        os.close(tmp_fd)

        with open(tmp_video_path, "wb") as f:
            f.write(response.content)

        print(f"✅ Video saved → {tmp_video_path}")

        # ── 2. DETERMINE LINE ──
        line = _derive_line(req.lane_id, req.line_type)

        # ── 3. OUTPUT VIDEO PATH ──
        output_video_path = os.path.join(
            DEBUG_VIDEO_DIR,
            f"{req.intersection_id}_{req.lane_id}_{int(time.time())}.mp4",
        )

        # ── 4. VIDEO PREDICTION ──
        print("🚀 Running video model...")
        video_result = raahat_predict_video(
            input_video_path=tmp_video_path,
            output_video_path=output_video_path,
            line=line
        )

        # ── 5. AUDIO PREDICTION ──
        print("🎧 Running audio model...")
        audio_used = True
        audio_emergency = False
        audio_confidence = 0.0

        try:
            audio_result = raahat_predict_audio(tmp_video_path)
            print(f"🎧 Audio result: {audio_result}")

            if "error" in audio_result:
                print(f"⚠️ Audio skipped: {audio_result['error']}")
                audio_used = False
            else:
                audio_emergency = audio_result["emergency_audio"]
                audio_confidence = audio_result["confidence"]
                print(f"🎧 Audio emergency={audio_emergency}, confidence={audio_confidence}")

        except Exception as e:
            print(f"⚠️ Audio failed: {e}")
            import traceback
            traceback.print_exc()
            audio_used = False

        # ── 6. 🔥 FUSION SCORING ──

        # Video emergency
        video_emergency = video_result["emergency_video"]

        # 🔹 Video score
        video_score = 0.8 if video_emergency else 0.2

        # 🔹 Audio score
        if audio_used and audio_emergency:
            audio_score = audio_confidence
        else:
            audio_score = 0.2

        # 🔹 Final score
        final_score = 0.4 * video_score + 0.6 * audio_score

        # 🔹 Final decision
        final_emergency = final_score >= 0.65

        print(f"🔥 FUSION: video_emergency={video_emergency}, audio_used={audio_used}, "
              f"audio_emergency={audio_emergency}")
        print(f"🔥 SCORES: video={video_score}, audio={audio_score}, "
              f"final={final_score:.3f}, emergency={final_emergency}")

        # ── 7. RESPONSE ──
        return {
            "line": video_result["line"],
            "vehicle_count": video_result["vehicle_count"],
            "density": video_result["density"],
            "avg_speed": video_result["avg_speed"],
            "emergency": final_emergency,
            "audio_used": audio_used,
            "video_score": round(video_score, 3),
            "audio_score": round(audio_score, 3),
            "final_score": round(final_score, 3),
        }

    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if tmp_video_path and os.path.exists(tmp_video_path):
            os.remove(tmp_video_path)


# ══════════ HELPER ══════════

def _derive_line(lane_id: str, line_type: Optional[str]) -> str:
    if line_type:
        return line_type

    lane = lane_id.upper()

    if lane in ("A", "C"):
        return "horizontal"
    elif lane in ("B", "D"):
        return "vertical"

    return "horizontal"


# ══════════ RUN SERVER ══════════

if __name__ == "__main__":
    uvicorn.run(
        "predict:app",
        host="0.0.0.0",
        port=MODEL_PORT,
        reload=True,
    )