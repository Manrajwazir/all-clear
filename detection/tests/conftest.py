"""
conftest.py — pytest configuration for the detection service.
Adds detection/src/ to sys.path so test files can import modules
(detector, debounce, etc.) without package-prefix syntax.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
