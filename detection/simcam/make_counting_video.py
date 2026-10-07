"""
make_counting_video.py -- write clips/counting.mp4 for the simulated camera.

    python simcam/make_counting_video.py            # 5 minutes at 15 fps
    python simcam/make_counting_video.py --seconds 60

Generated, never committed: clips/ is gitignored, and a real clip recorded later
will have a person in it.
"""

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from simcam.counting import HEIGHT, WIDTH, draw_index  # noqa: E402

FPS = 15


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seconds", type=int, default=300)
    parser.add_argument("--out", default=str(Path(__file__).parent / "clips" / "counting.mp4"))
    args = parser.parse_args()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(str(out), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
    if not writer.isOpened():
        sys.exit(f"could not open a video writer for {out}")

    total = args.seconds * FPS
    for n in range(total):
        frame = np.full((HEIGHT, WIDTH, 3), 90, dtype=np.uint8)
        draw_index(frame, n)
        cv2.putText(frame, f"simcam frame {n}", (20, 220),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.4, (255, 255, 255), 3, cv2.LINE_AA)
        writer.write(frame)
    writer.release()
    print(f"wrote {out} ({total} frames, {args.seconds} s at {FPS} fps)")


if __name__ == "__main__":
    main()
