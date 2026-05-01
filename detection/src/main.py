"""
main.py — SiteIQ Detection Service Entry Point
-----------------------------------------------
Phase 1 complete: live webcam detection loop.

Data flow:
  OpenCV (webcam) → PPEDetector.predict() (YOLO on GPU) →
  PPEDetector.find_violations() → annotated frame displayed in window

Run from the detection/ folder:
    cd detection
    python src/main.py

Controls:
    q — quit
    s — save a snapshot to docs/phase1_snapshot.jpg
"""

import cv2
import time
import logging
from pathlib import Path
from dotenv import load_dotenv

from detector import PPEDetector, VIOLATION_CLASSES

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# --- Config (overridden by .env in later phases) ---
MODEL_PATH = "models/ppe_v1.pt"
CONFIDENCE = 0.6
CAMERA_INDEX = 0  # 0 = default webcam; replace with RTSP URL string for IP camera


def run_detection():
    logger.info("Loading PPE model...")
    detector = PPEDetector(model_path=MODEL_PATH)

    logger.info(f"Opening camera {CAMERA_INDEX}...")
    cap = cv2.VideoCapture(CAMERA_INDEX)

    if not cap.isOpened():
        logger.error(
            "Could not open camera. "
            "Windows fix: Settings → Privacy & Security → Camera → "
            "Allow desktop apps to access your camera."
        )
        return

    print("\n" + "=" * 58)
    print("  SiteIQ Phase 1 — Live PPE Detection")
    print(f"  Monitoring for: {', '.join(sorted(VIOLATION_CLASSES))}")
    print("  Press  q  to quit  |  s  to save a snapshot")
    print("=" * 58 + "\n")

    fps = 0.0
    frame_count = 0
    fps_start = time.time()

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            logger.warning("Empty frame received — skipping.")
            continue

        # Run YOLO inference (uses CUDA if available, falls back to CPU)
        results = detector.predict(frame, confidence=CONFIDENCE)

        # Pull out only the "bad" detections (NO-Hardhat, NO-Safety Vest, NO-Mask)
        violations = detector.find_violations(results[0])

        # Draw bounding boxes + class labels on the frame (built into ultralytics)
        annotated = results[0].plot()

        # Rolling FPS: recalculate every 30 frames to avoid jitter
        frame_count += 1
        if frame_count % 30 == 0:
            fps = 30 / (time.time() - fps_start)
            fps_start = time.time()

        # Status bar: FPS + live violation count, red if violations present
        num_violations = len(violations)
        label = f"FPS: {fps:.1f}  |  Active violations: {num_violations}"
        color = (0, 0, 220) if num_violations > 0 else (0, 180, 0)
        cv2.putText(annotated, label, (10, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.85, color, 2, cv2.LINE_AA)

        # Log each violation type + confidence to the terminal
        for v in violations:
            logger.info(
                f"VIOLATION  type={v['violation_type']}  conf={v['confidence']:.2f}"
            )

        cv2.imshow("SiteIQ — Phase 1 Detection", annotated)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            logger.info("Quit signal received.")
            break
        elif key == ord('s'):
            snapshot_path = Path("../docs/phase1_snapshot.jpg")
            snapshot_path.parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(snapshot_path), annotated)
            logger.info(f"Snapshot saved → {snapshot_path.resolve()}")

    cap.release()
    cv2.destroyAllWindows()
    logger.info("Detection loop stopped cleanly.")


if __name__ == "__main__":
    run_detection()
