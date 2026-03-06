import os
import sys
import cv2
import numpy as np
from dotenv import load_dotenv
from ultralytics import YOLO

from Utils import (
    build_session,
    post_update_async,
    calculate_iou,
    transform_box,
    apply_roi_mask,
    draw_detections,
    draw_spots,
    draw_fps,
    FPSCounter,
)

# ─── LOAD CONFIG ─────────────────────────────────────────────────────────────

load_dotenv()

CONFIG = {
    "server_url":    os.getenv("SERVER_URL",          "http://localhost:3001"),
    "video_path":    os.getenv("VIDEO_PATH",          "test_video.mp4"),
    "model_path":    os.getenv("MODEL_PATH",          "yolo11n.pt"),
    "confidence":    float(os.getenv("CONFIDENCE",    "0.35")),
    "min_box_area":  int(os.getenv("MIN_BOX_AREA",    "500")),
    "iou_threshold": float(os.getenv("IOU_THRESHOLD", "0.50")),  # 50% of spot must be covered
    "http_retries":  int(os.getenv("HTTP_RETRIES",    "3")),
    "http_backoff":  float(os.getenv("HTTP_BACKOFF_FACTOR", "0.5")),
    "frame_width":   int(os.getenv("FRAME_WIDTH",     "800")),
    "frame_height":  int(os.getenv("FRAME_HEIGHT",    "600")),
}

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def fetch_spots(session, url: str) -> list[dict]:
    print("🛰️  Connecting to ParkVision Server...")
    try:
        response = session.get(f"{url}/api/map-config", timeout=10)
        response.raise_for_status()
        spots = response.json()
        print(f"✅  Loaded {len(spots)} spots from backend.")
        return spots
    except Exception as exc:
        print(f"❌  Could not reach server: {exc}")
        sys.exit(1)


def load_homography() -> np.ndarray | None:
    """Loads homography matrix saved by calibrate.py. Returns None for top-down mode."""
    try:
        H = np.load("homography.npy")
        print("🗺️  Homography matrix loaded! Running in perspective-corrected mode.")
        return H
    except FileNotFoundError:
        print("⚠️  No homography.npy found. Running in basic top-down mode.")
        print("    (Run calibrate.py to enable perspective correction)")
        return None


def make_roi(w: int, h: int) -> list[tuple]:
    return [
        (int(w * 0.00), int(h * 0.00)),
        (int(w * 1.00), int(h * 0.00)),
        (int(w * 1.00), int(h * 1.00)),  
        (int(w * 0.00), int(h * 1.00)),
    ]


# ─── MAIN LOOP ────────────────────────────────────────────────────────────────

def main() -> None:
    session = build_session(
        retries=CONFIG["http_retries"],
        backoff_factor=CONFIG["http_backoff"],
    )

    spots = fetch_spots(session, CONFIG["server_url"])
    last_known_states: dict[str, str] = {spot["id"]: "vacant" for spot in spots}

    # Temporal smoothing — spot only changes state when majority of recent frames agree
    SMOOTH_FRAMES = 5
    vote_buffer: dict[str, list[str]] = {spot["id"]: [] for spot in spots}

    H_matrix = load_homography()
    model = YOLO(CONFIG["model_path"])
    fps_counter = FPSCounter(window=30)

    cap = cv2.VideoCapture(CONFIG["video_path"])
    if not cap.isOpened():
        print(f"❌  Cannot open video: {CONFIG['video_path']}")
        sys.exit(1)

    # Read raw resolution ONCE so ROI scales correctly in homography mode
    raw_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    raw_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if raw_w == 0 or raw_h == 0:
        success, temp = cap.read()
        if success:
            raw_h, raw_w = temp.shape[:2]
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    # Two ROI versions — homography uses raw resolution, top-down uses 800x600
    ROI_RAW    = make_roi(raw_w, raw_h)
    ROI_SCALED = make_roi(CONFIG["frame_width"], CONFIG["frame_height"])

    print(f"🎯  IoS threshold: {CONFIG['iou_threshold']*100:.0f}% spot coverage required")
    print("▶️  Processing video feed. Press 'q' to quit.")

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            # Loop video back to start
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        updates: dict[str, str] = {}

        if H_matrix is not None:
            # ── HOMOGRAPHY MODE ───────────────────────────────────────────────
            # YOLO runs on RAW frame — matrix was calibrated on raw pixels.
            masked_frame = apply_roi_mask(frame, ROI_RAW)
            results = model.track(masked_frame, persist=True, conf=CONFIG["confidence"], imgsz=640, verbose=False)
            vehicle_boxes = draw_detections(frame, results, CONFIG["min_box_area"])

            for spot in spots:
                spot_box = [
                    spot["x"], spot["y"],
                    spot["x"] + spot["w"], spot["y"] + spot["h"],
                ]
                status = "vacant"
                for car_data in vehicle_boxes:
                    car_box = car_data["box"]
                    # Step 1: Correct perspective — project car box into map space
                    corrected_box = transform_box(car_box, H_matrix)
                    # Step 2: IoS — what % of the spot is covered by the corrected car box
                    score = calculate_iou(spot_box, corrected_box)
                    if score > CONFIG["iou_threshold"]:
                        status = "occupied"
                        break

                # Temporal smoothing
                buf = vote_buffer[spot["id"]]
                buf.append(status)
                if len(buf) > SMOOTH_FRAMES:
                    buf.pop(0)
                majority = "occupied" if buf.count("occupied") > len(buf) / 2 else "vacant"
                if majority != last_known_states[spot["id"]]:
                    updates[spot["id"]] = majority
                    last_known_states[spot["id"]] = majority

            # Resize ONLY for the display window — never affects detection
            display_frame = cv2.resize(frame, (CONFIG["frame_width"], CONFIG["frame_height"]))
            draw_spots(display_frame, spots, last_known_states)
            draw_fps(display_frame, fps_counter.tick())
            cv2.imshow("ParkVision AI Brain [Homography Mode]", display_frame)

        else:
            # ── TOP-DOWN MODE ─────────────────────────────────────────────────
            # Resize first — frame and map must be the same coordinate space.
            frame = cv2.resize(frame, (CONFIG["frame_width"], CONFIG["frame_height"]))
            masked_frame = apply_roi_mask(frame, ROI_SCALED)
            results = model.track(masked_frame, persist=True, conf=CONFIG["confidence"], verbose=False)
            vehicle_boxes = draw_detections(frame, results, CONFIG["min_box_area"])

            for spot in spots:
                spot_box = [
                    spot["x"], spot["y"],
                    spot["x"] + spot["w"], spot["y"] + spot["h"],
                ]
                status = "vacant"
                for car_data in vehicle_boxes:
                    car_box = car_data["box"]
                    # IoS — what % of the spot is covered by the car box
                    score = calculate_iou(spot_box, car_box)
                    if score > CONFIG["iou_threshold"]:
                        status = "occupied"
                        break

                # Temporal smoothing
                buf = vote_buffer[spot["id"]]
                buf.append(status)
                if len(buf) > SMOOTH_FRAMES:
                    buf.pop(0)
                majority = "occupied" if buf.count("occupied") > len(buf) / 2 else "vacant"
                if majority != last_known_states[spot["id"]]:
                    updates[spot["id"]] = majority
                    last_known_states[spot["id"]] = majority

            draw_spots(frame, spots, last_known_states)
            draw_fps(frame, fps_counter.tick())
            cv2.imshow("ParkVision AI Brain [Top-Down Mode]", frame)

        # ── Shared: send updates & handle quit ───────────────────────────────
        if updates:
            post_update_async(session, f"{CONFIG['server_url']}/api/update", updates)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("🛑  Feed closed.")


if __name__ == "__main__":
    main()