"""
test_detector.py — unit tests for PPEDetector.find_violations().

We mock the YOLO model so these tests run without a GPU or a real .pt file.
The logic we're testing is "given a set of detected boxes, does the
detector correctly identify which ones are violations?"
"""

from unittest.mock import MagicMock, patch


# The 10 class names the ppe_v1.pt model knows
CLASS_NAMES = {
    0: "Hardhat",
    1: "Mask",
    2: "NO-Hardhat",
    3: "NO-Mask",
    4: "NO-Safety Vest",
    5: "Person",
    6: "Safety Cone",
    7: "Safety Vest",
    8: "machinery",
    9: "vehicle",
}


def _make_box(cls_id: int, conf: float) -> MagicMock:
    """Return a fake YOLO Box object with the given class index and confidence."""
    box = MagicMock()
    box.cls = [cls_id]
    box.conf = [conf]
    return box


def _make_result(boxes, class_names=CLASS_NAMES) -> MagicMock:
    """Return a fake YOLO Result object containing the given boxes."""
    result = MagicMock()
    result.boxes = boxes
    result.names = class_names
    return result


@patch("detector.YOLO")
def test_no_hardhat_is_flagged(mock_yolo_cls):
    from detector import PPEDetector

    mock_yolo_cls.return_value = MagicMock(names=CLASS_NAMES)
    detector = PPEDetector(model_path="fake.pt")

    result = _make_result([_make_box(cls_id=2, conf=0.85)])  # NO-Hardhat
    violations = detector.find_violations(result)

    assert len(violations) == 1
    assert violations[0]["violation_type"] == "no_hardhat"
    assert abs(violations[0]["confidence"] - 0.85) < 0.01


@patch("detector.YOLO")
def test_no_vest_is_flagged(mock_yolo_cls):
    from detector import PPEDetector

    mock_yolo_cls.return_value = MagicMock(names=CLASS_NAMES)
    detector = PPEDetector(model_path="fake.pt")

    result = _make_result([_make_box(cls_id=4, conf=0.72)])  # NO-Safety Vest
    violations = detector.find_violations(result)

    assert len(violations) == 1
    assert violations[0]["violation_type"] == "no_safety_vest"


@patch("detector.YOLO")
def test_safe_classes_are_ignored(mock_yolo_cls):
    """Hardhat, Safety Vest, Mask = worker IS compliant — no violation."""
    from detector import PPEDetector

    mock_yolo_cls.return_value = MagicMock(names=CLASS_NAMES)
    detector = PPEDetector(model_path="fake.pt")

    safe_boxes = [
        _make_box(cls_id=0, conf=0.95),  # Hardhat
        _make_box(cls_id=7, conf=0.88),  # Safety Vest
        _make_box(cls_id=5, conf=0.99),  # Person
    ]
    result = _make_result(safe_boxes)
    violations = detector.find_violations(result)

    assert violations == []


@patch("detector.YOLO")
def test_empty_frame_returns_no_violations(mock_yolo_cls):
    from detector import PPEDetector

    mock_yolo_cls.return_value = MagicMock(names=CLASS_NAMES)
    detector = PPEDetector(model_path="fake.pt")

    result = _make_result(boxes=None)
    violations = detector.find_violations(result)

    assert violations == []


@patch("detector.YOLO")
def test_mixed_frame_only_returns_violations(mock_yolo_cls):
    """Frame with both compliant and non-compliant workers — only flag the bad ones."""
    from detector import PPEDetector

    mock_yolo_cls.return_value = MagicMock(names=CLASS_NAMES)
    detector = PPEDetector(model_path="fake.pt")

    boxes = [
        _make_box(cls_id=2, conf=0.80),  # NO-Hardhat       — violation
        _make_box(cls_id=4, conf=0.75),  # NO-Safety Vest   — violation
        _make_box(cls_id=0, conf=0.95),  # Hardhat          — safe, ignored
        _make_box(cls_id=5, conf=0.99),  # Person           — safe, ignored
    ]
    result = _make_result(boxes)
    violations = detector.find_violations(result)

    assert len(violations) == 2
    types = {v["violation_type"] for v in violations}
    assert "no_hardhat" in types
    assert "no_safety_vest" in types
