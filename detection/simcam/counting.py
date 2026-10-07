"""
counting.py -- a video whose every frame carries its own frame number.

Each frame has a row of 16 large black or white blocks along the top: frame
number n, in binary, least significant bit on the left. Reading the blocks back
off a received frame says exactly which frame it is, so a test can measure how
old a frame is when the detection loop gets it (block 1 plan, G5) instead of
guessing.

Blocks are 40 x 40 pixels so they survive H.264 compression; reading uses the
average of each block's centre, not single pixels.
"""

import numpy as np

WIDTH, HEIGHT = 640, 360
BITS = 16
BLOCK = WIDTH // BITS        # 40 px
MARGIN = 8                   # read only the centre of each block


def draw_index(frame: np.ndarray, n: int) -> None:
    """Paint frame number n into the top row of blocks, in place."""
    for bit in range(BITS):
        value = 255 if (n >> bit) & 1 else 0
        x = bit * BLOCK
        frame[0:BLOCK, x:x + BLOCK] = value


def read_index(frame: np.ndarray) -> int:
    """The frame number painted by draw_index, read from a decoded frame."""
    n = 0
    for bit in range(BITS):
        x = bit * BLOCK
        centre = frame[MARGIN:BLOCK - MARGIN, x + MARGIN:x + BLOCK - MARGIN]
        if centre.mean() > 127:
            n |= 1 << bit
    return n
