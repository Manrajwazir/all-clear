"""
test_gpu.py — GPU Diagnostic
Run from detection/ folder:
    python tests/test_gpu.py
"""
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

print("\n=== All Clear GPU Diagnostic ===\n")

# --- 1. PyTorch CUDA ---
import torch
cuda_available = torch.cuda.is_available()
print(f"CUDA available:   {'YES ✓' if cuda_available else 'NO ✗'}")
if cuda_available:
    print(f"GPU:              {torch.cuda.get_device_name(0)}")
    print(f"VRAM:             {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    print(f"CUDA version:     {torch.version.cuda}")
else:
    print("  → Running on CPU. Install torch+cu126:")
    print("    pip uninstall torch torchvision -y")
    print("    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126")

# --- 2. YOLO device ---
print()
try:
    from ultralytics import YOLO
    model_path = "models/ppe_v1.pt"
    if not Path(model_path).exists():
        print(f"YOLO model:       NOT FOUND at {model_path}")
    else:
        device = "cuda:0" if cuda_available else "cpu"
        print(f"Loading model on: {device} ...")
        model = YOLO(model_path)
        model.to(device)
        actual_device = next(model.model.parameters()).device
        print(f"YOLO device:      {actual_device}  {'✓ GPU' if 'cuda' in str(actual_device) else '✗ CPU — slow!'}")

        # --- 3. FPS benchmark ---
        import cv2
        import numpy as np
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        print("\nRunning 20-frame inference benchmark...")
        start = time.perf_counter()
        for _ in range(20):
            model.predict(source=dummy, conf=0.6, verbose=False, device=device)
        elapsed = time.perf_counter() - start
        fps = 20 / elapsed
        print(f"Inference FPS:    {fps:.1f}  ({'fast ✓' if fps > 15 else 'slow ✗ — likely CPU'})")
        print(f"Per frame:        {elapsed/20*1000:.1f} ms")
except Exception as e:
    print(f"YOLO test failed: {e}")

print("\n=== Done ===\n")
