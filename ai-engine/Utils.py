import cv2
import time
import threading
import requests
import numpy as np
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ─── HTTP SESSION WITH RETRY ──────────────────────────────────────────────────
def build_session(retries: int = 3, backoff_factor: float = 0.5) -> requests.Session:
    session = requests.Session()
    retry_strategy = Retry(
        total=retries,
        backoff_factor=backoff_factor,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET", "POST"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


# ─── ASYNC POST ───────────────────────────────────────────────────────────────
def post_update_async(session: requests.Session, url: str, payload: dict) -> None:
    def _send():
        try:
            session.post(url, json=payload, timeout=5)
        except Exception:
            pass
    thread = threading.Thread(target=_send, daemon=True)
    thread.start()


# ─── HOMOGRAPHY ───────────────────────────────────────────────────────────────
def transform_box(box: list[int], matrix: np.ndarray) -> list[float]:
    """
    Isolates the vehicle's footprint (bottom 30%), projects it through
    the homography matrix, and returns the corrected axis-aligned
    bounding box in map space for accurate IoU calculation.
    """
    x1, y1, x2, y2 = box

    # 1. Isolate the bottom 30% (The 'True' Footprint)
    # This minimizes 'perspective leaning' from the car's height.
    car_height = y2 - y1
    footprint_y1 = y2 - (car_height * 0.50) 

    # 2. Define the 4 corners of the footprint
    corners = np.float32([[
        [x1, footprint_y1],
        [x2, footprint_y1],
        [x2, y2],
        [x1, y2],
    ]])

    # 3. Project corners from Angled Video Space -> Flat Map Space
    transformed = cv2.perspectiveTransform(corners, matrix)
    pts = transformed[0]

    # 4. Return the new coordinates in Map Space
    # We use float() cast to ensure compatibility with JSON/API sending.
    return [
        float(np.min(pts[:, 0])),
        float(np.min(pts[:, 1])),
        float(np.max(pts[:, 0])),
        float(np.max(pts[:, 1])),
    ]


# ─── IoU MATH (Intersection over Spot) ───────────────────────────────────────
def calculate_iou(spot_box: list, car_box: list) -> float:
    """
    Calculates Intersection-over-Spot (IoS).
    Answers: 'What percentage of the green spot is covered by the car?'
    """
    # 1. Calculate the intersection (overlap) coordinates
    x_a = max(spot_box[0], car_box[0])
    y_a = max(spot_box[1], car_box[1])
    x_b = min(spot_box[2], car_box[2])
    y_b = min(spot_box[3], car_box[3])

    inter_area = max(0, x_b - x_a) * max(0, y_b - y_a)
    if inter_area == 0:
        return 0.0

    # 2. Calculate ONLY the area of the parking spot
    # Standard IoU uses: area_a + area_b - inter_area (Too large!)
    # We use: spot_area (Perfect for occupancy)
    spot_area = (spot_box[2] - spot_box[0]) * (spot_box[3] - spot_box[1])
    
    return inter_area / float(spot_area) if spot_area > 0 else 0.0


# ─── DRAWING HELPERS ─────────────────────────────────────────────────────────

def extract_vehicle_boxes(results, min_box_area: int) -> list[dict]:
    """
    Filters YOLO detections by SIZE and SHAPE only — no class ID filter.

    Why no class filter?
    On angled/indoor cameras YOLO was trained on street-level images, so it
    almost never predicts class 2 (car) from above or from the side. It calls
    car roofs 'suitcases', 'laptops', 'dining tables', etc.
    Filtering by class ID silently drops every real vehicle detection.

    Instead we filter by:
    - Minimum area   → removes noise and people
    - Aspect ratio   → removes thin poles, lines, and people
    """
    boxes = []
    for box in results[0].boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        w, h = x2 - x1, y2 - y1
        area = w * h

        # Too small — noise, pedestrians, distant objects
        if area < min_box_area:
            continue

        # Aspect ratio check — cars are roughly square-ish from any angle
        # Anything thinner than 5:1 is likely a person, pole, or line
        aspect = max(w, h) / (min(w, h) + 1e-5)
        if aspect > 5.0:
            continue

        # Get track ID if available
        track_id = int(box.id[0]) if box.id is not None else -1
        boxes.append({
            "box": [x1, y1, x2, y2],
            "track_id": track_id,
            "conf": float(box.conf[0])
        })
    return boxes


def draw_detections(frame, results, min_box_area: int) -> list[dict]:
    """
    Draws detection boxes on frame and returns filtered vehicle boxes.
    Label shows the actual YOLO class name so you can see what it's
    detecting — useful for debugging misclassifications.
    """
    vehicle_boxes = extract_vehicle_boxes(results, min_box_area)

    # Build a quick lookup so we only draw boxes that passed the filter
    passed = {tuple(v["box"]) for v in vehicle_boxes}

    for box in results[0].boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        if (x1, y1, x2, y2) not in passed:
            continue

        conf = float(box.conf[0])

        # Force label to "Vehicle" regardless of what YOLO guessed.
        # From a top-down/angled camera, YOLO will call car roofs
        # "cell phone", "bottle", "suitcase" etc. — the class name
        # is meaningless here. What matters is size + shape passed our filter.
        label = "Vehicle"

        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
        cv2.putText(
            frame, f"{label} ({conf:.2f})",
            (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 0, 0), 2
        )

    return vehicle_boxes


def draw_spots(frame, spots: list[dict], states: dict[str, str]) -> None:
    """Green = vacant, Red = occupied."""
    for spot in spots:
        color = (0, 0, 255) if states[spot["id"]] == "occupied" else (0, 255, 0)
        cv2.rectangle(
            frame,
            (int(spot["x"]), int(spot["y"])),
            (int(spot["x"] + spot["w"]), int(spot["y"] + spot["h"])),
            color, 2,
        )


def draw_fps(frame, fps: float) -> None:
    cv2.putText(
        frame, f"FPS: {fps:.1f}",
        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 255), 2
    )


# ─── ROI MASK ─────────────────────────────────────────────────────────────────
def apply_roi_mask(frame, roi_points: list) -> np.ndarray:
    """
    Blacks out everything outside the parking area polygon.
    YOLO will only detect vehicles inside the defined region,
    eliminating false positives from roads and driveways.
    roi_points = list of (x, y) tuples defining the parking boundary.
    """
    mask = np.zeros(frame.shape[:2], dtype=np.uint8)
    pts = np.array(roi_points, dtype=np.int32)
    cv2.fillPoly(mask, [pts], 255)
    return cv2.bitwise_and(frame, frame, mask=mask)


# ─── FPS TRACKER ─────────────────────────────────────────────────────────────
class FPSCounter:
    """Lightweight rolling-average FPS tracker."""

    def __init__(self, window: int = 30):
        self._window = window
        self._timestamps: list[float] = []

    def tick(self) -> float:
        """Call once per processed frame. Returns current smoothed FPS."""
        now = time.monotonic()
        self._timestamps.append(now)
        if len(self._timestamps) > self._window:
            self._timestamps.pop(0)
        if len(self._timestamps) < 2:
            return 0.0
        elapsed = self._timestamps[-1] - self._timestamps[0]
        return (len(self._timestamps) - 1) / elapsed if elapsed > 0 else 0.0