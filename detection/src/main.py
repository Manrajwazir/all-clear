"""
main.py — All Clear Detection Service Entry Point
-----------------------------------------------
Phase 2: live detection loop + debounce + Supabase logging + S3 snapshots.

Data flow per frame:
  OpenCV (webcam)
    → PPEDetector.predict()         [YOLO inference on GPU]
    → PPEDetector.find_violations() [filter for NO-Hardhat etc.]
    → ViolationTracker.should_alert() [debounce + cooldown]
    → cv2.imencode()                [encode frame to JPEG bytes]
    → upload_snapshot()             [save image to S3]
    → log_violation()               [insert row in Supabase]
    → annotated frame shown in window

Run from the detection/ folder:
    cd detection
    python src/main.py

Controls:
    q — quit
    s — save a snapshot to docs/phase1_snapshot.jpg
"""

import os
import sys
import cv2
import time
import logging
from pathlib import Path
from dotenv import load_dotenv

# Add src/ to path so imports work when running from detection/
sys.path.insert(0, str(Path(__file__).parent))

from detector import PPEDetector, VIOLATION_CLASSES
from debounce import ViolationTracker
from storage import upload_snapshot, log_violation
from alerts import send_violation_sms

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# --- Config (reads from .env, falls back to defaults) ---
MODEL_PATH    = "models/ppe_v1.pt"
CONFIDENCE    = float(os.getenv("DETECTION_CONFIDENCE_THRESHOLD", 0.6))
DEBOUNCE_F    = int(os.getenv("DEBOUNCE_FRAMES", 5))
COOLDOWN_S    = int(os.getenv("COOLDOWN_SECONDS", 60))
CAMERA_INDEX  = 0   # 0 = default webcam; swap for RTSP URL string for IP camera

# Hardcoded camera UUID for MVP (single site, single camera)
# Replace this with your actual camera UUID from Supabase once you insert a row
CAMERA_ID = "00000000-0000-0000-0000-000000000001"

# Check if Supabase is configured — if not, run in "local log only" mode
STORAGE_ENABLED = all([
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
    os.getenv("AWS_ACCESS_KEY_ID"),
    os.getenv("S3_BUCKET_NAME"),
])

TWILIO_ENABLED = all([
    os.getenv("TWILIO_ACCOUNT_SID"),
    os.getenv("TWILIO_AUTH_TOKEN"),
    os.getenv("TWILIO_FROM_NUMBER"),
    os.getenv("TWILIO_TO_NUMBER"),
])

if not STORAGE_ENABLED:
    logger.warning(
        "Supabase / AWS not configured in .env — "
        "running in LOCAL LOG ONLY mode. Violations print to terminal only."
    )
else:
    logger.info("Storage enabled: violations will be saved to Supabase + S3.")

if not TWILIO_ENABLED:
    logger.warning("Twilio not configured in .env — SMS alerts disabled.")
else:
    logger.info("Twilio enabled: SMS alerts will fire on confirmed violations.")


def run_detection():
    logger.info("Loading PPE model...")
    detector = PPEDetector(model_path=MODEL_PATH)

    # One tracker per process — tracks debounce + cooldown state
    tracker = ViolationTracker(
        debounce_frames=DEBOUNCE_F,
        cooldown_seconds=COOLDOWN_S
    )

    logger.info(f"Opening camera {CAMERA_INDEX}...")
    cap = cv2.VideoCapture(CAMERA_INDEX)

    if not cap.isOpened():
        logger.error(
            "Could not open camera. "
            "Windows fix: Settings → Privacy & Security → Camera → "
            "Allow desktop apps to access your camera."
        )
        return

    # Push camera to max FPS and disable internal buffer lag.
    # CAP_PROP_BUFFERSIZE = 1 means OpenCV keeps only the latest frame,
    # so we never process stale buffered frames when inference is slower than camera.
    cap.set(cv2.CAP_PROP_FPS, 60)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    print("\n" + "=" * 62)
    print("  All Clear — Live PPE Detection + Violation Logger")
    print(f"  Monitoring: {', '.join(sorted(VIOLATION_CLASSES))}")
    print(f"  Debounce: {DEBOUNCE_F} frames | Cooldown: {COOLDOWN_S}s")
    mode = "Supabase + S3" if STORAGE_ENABLED else "LOCAL LOG ONLY"
    print(f"  Storage mode: {mode}")
    sms_mode = "ON" if TWILIO_ENABLED else "OFF (fill Twilio keys in .env)"
    print(f"  SMS alerts:   {sms_mode}")
    print("  Press  q or ESC  to quit  |  s  to save a snapshot")
    print("  NOTE: click the camera window first, THEN press q")
    print("=" * 62 + "\n")

    fps = 0.0
    frame_count = 0
    fps_start = time.time()

    while True:
        # Grab and discard any queued frames so we always get the freshest one.
        # This matters when inference takes longer than the camera frame interval.
        cap.grab()
        ret, frame = cap.retrieve()
        if not ret or frame is None:
            logger.warning("Empty frame received — skipping.")
            continue

        # 1. Run YOLO inference
        results = detector.predict(frame, confidence=CONFIDENCE)

        # 2. Filter for violation classes only
        violations = detector.find_violations(results[0])

        # 3. Draw bounding boxes + labels on frame
        annotated = results[0].plot()

        # 4. Rolling FPS (recalculate every 30 frames)
        frame_count += 1
        if frame_count % 30 == 0:
            fps = 30 / (time.time() - fps_start)
            fps_start = time.time()

        # 5. Status bar overlay
        num_violations = len(violations)
        label = f"FPS: {fps:.1f}  |  Active violations: {num_violations}"
        color = (0, 0, 220) if num_violations > 0 else (0, 180, 0)
        cv2.putText(annotated, label, (10, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.85, color, 2, cv2.LINE_AA)

        # 6. For each violation — check debounce, then save + alert
        for v in violations:
            v_type = v["violation_type"]
            conf   = v["confidence"]

            logger.info(f"DETECTED   type={v_type}  conf={conf:.2f}")

            if tracker.should_alert(v_type):
                logger.info(f"ALERT      type={v_type} — debounce passed, firing pipeline")

                snapshot_key = None

                if STORAGE_ENABLED:
                    try:
                        # Encode the current frame as JPEG bytes
                        success, buffer = cv2.imencode(".jpg", frame)
                        if success:
                            snapshot_key = upload_snapshot(
                                frame_bytes=buffer.tobytes(),
                                camera_id=CAMERA_ID
                            )
                            logger.info(f"S3 upload OK → {snapshot_key}")
                        else:
                            logger.warning("JPEG encode failed — skipping S3 upload")
                    except Exception as e:
                        logger.error(f"S3 upload failed: {e}")

                    try:
                        log_violation(
                            camera_id=CAMERA_ID,
                            violation_type=v_type,
                            confidence=conf,
                            snapshot_s3_key=snapshot_key
                        )
                        logger.info(f"Supabase log OK — type={v_type}")
                    except Exception as e:
                        logger.error(f"Supabase log failed: {e}")

                    # Phase 3 — SMS alert
                    if TWILIO_ENABLED:
                        send_violation_sms(
                            violation_type=v_type,
                            camera_name="Webcam Dev Camera",
                            snapshot_key=snapshot_key or "no-image"
                        )
                else:
                    # No storage configured — just print
                    logger.info(
                        f"[LOCAL] Would log: type={v_type} conf={conf:.2f} "
                        f"camera={CAMERA_ID}"
                    )

        cv2.imshow("All Clear — Detection", annotated)

        # waitKey(1) — minimal delay, GPU inference controls actual FPS now
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q') or key == 27:  # 27 = ESC
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
