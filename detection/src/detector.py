"""
detector.py
-----------
Wraps the YOLO model. All inference logic lives here.
main.py calls this — it never touches ultralytics directly.

Usage:
    detector = PPEDetector("models/ppe_v1.pt")
    results = detector.predict(frame, confidence=0.6)
    violations = detector.find_violations(results[0])
"""

from ultralytics import YOLO


# Violation classes — these are the "bad" classes we want to alert on.
# The model also detects "good" classes (Hardhat, Safety Vest, Mask)
# but we only fire alerts on the negative ones.
VIOLATION_CLASSES = {"NO-Hardhat", "NO-Safety Vest", "NO-Mask"}


class PPEDetector:
    def __init__(self, model_path: str = "models/ppe_v1.pt"):
        """Load the YOLO model from disk."""
        self.model = YOLO(model_path)
        self.class_names = self.model.names  # dict: {0: 'Hardhat', 1: 'Mask', ...}
        print(f"[detector] Model loaded. Classes: {self.class_names}")

    def predict(self, source, confidence: float = 0.6):
        """
        Run inference on a source (image path, video path, frame, or camera index).
        Returns a list of ultralytics Result objects.
        """
        results = self.model.predict(source=source, conf=confidence, verbose=False)
        return results

    def find_violations(self, result) -> list[dict]:
        """
        Given a single YOLO Result object, extract only the violation detections.
        Returns a list of dicts with violation_type and confidence.

        Example return:
            [{"violation_type": "no_helmet", "confidence": 0.87}, ...]
        """
        violations = []
        if result.boxes is None:
            return violations

        for box in result.boxes:
            cls_id = int(box.cls[0])
            cls_name = self.class_names[cls_id]
            conf = float(box.conf[0])

            if cls_name in VIOLATION_CLASSES:
                # Normalize class name: "NO-Hardhat" -> "no_helmet", etc.
                v_type = cls_name.lower().replace("-", "_").replace(" ", "_")
                violations.append({
                    "violation_type": v_type,
                    "confidence": conf
                })

        return violations
