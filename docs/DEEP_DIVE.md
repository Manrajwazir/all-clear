# Cordon Safety — Deep Dive: Every File, Every Concept, Every Connection

This document is written for someone who knows the product idea but is still getting comfortable with Python and ML. No jargon is left unexplained. Read this top-to-bottom once; after that use it as a reference.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [What Phase 1 Actually Builds](#2-what-phase-1-actually-builds)
3. [ML Concepts You Need First](#3-ml-concepts-you-need-first)
4. [Python Concepts Used in This Codebase](#4-python-concepts-used-in-this-codebase)
5. [The Detection Service — File by File](#5-the-detection-service--file-by-file)
   - [pyproject.toml](#51-pyprojecttoml)
   - [.env.example / .env](#52-envexample--env)
   - [src/\_\_init\_\_.py](#53-src__init__py)
   - [src/detector.py](#54-srcdetectorpy)
   - [src/debounce.py](#55-srcdebouncepy)
   - [src/storage.py](#56-srcstoragepy)
   - [src/alerts.py](#57-srcalertspy)
   - [src/main.py](#58-srcmainpy)
6. [The Tests — File by File](#6-the-tests--file-by-file)
   - [tests/conftest.py](#61-testsconftestpy)
   - [tests/test\_detector.py](#62-teststest_detectorpy)
   - [tests/test\_debounce.py](#63-teststest_debouncepy)
7. [How All the Files Connect](#7-how-all-the-files-connect)
8. [What Each External Library Actually Does](#8-what-each-external-library-actually-does)
9. [The GPU Story](#9-the-gpu-story)
10. [Step-by-Step: What Happens When You Run main.py](#10-step-by-step-what-happens-when-you-run-mainpy)
11. [Setup: Everything You Need to Run Phase 1](#11-setup-everything-you-need-to-run-phase-1)
12. [Phase 1 Completion Checklist](#12-phase-1-completion-checklist)
13. [What the Next Phases Add](#13-what-the-next-phases-add)

---

## 1. The Big Picture

Cordon Safety watches a camera feed (your webcam in Phase 1, a construction site IP camera later) and detects when a worker is missing a hard hat, safety vest, or mask. When it spots a violation, it logs a record to a database, saves a photo to cloud storage, and sends the site supervisor an SMS.

The system has two major parts:

```
PART 1 — Detection Service (Python, on your laptop)
  - Watches the camera in real time
  - Runs an AI model on every frame
  - Decides when to fire an alert
  - Saves evidence to the database + photo storage
  - Sends the SMS

PART 2 — Supervisor Dashboard (Next.js, in a browser)
  - Shows all violations as they happen (live)
  - Lets the supervisor see the photo, mark it resolved,
    mark it a false positive, add notes
  - Shows charts (violations per hour, per type)
```

**Phase 1 is entirely Part 1, and only the camera-watching part** — no database, no SMS, no dashboard yet. Just: open camera → run AI model → draw boxes on screen → print violations to terminal.

---

## 2. What Phase 1 Actually Builds

After Phase 1 you can:

1. Run `python src/main.py` from the `detection/` folder
2. A window pops up showing your webcam feed
3. YOLO draws colored bounding boxes around anything it detects
4. If you are NOT wearing a hard hat, a red box labeled "NO-Hardhat" appears
5. The terminal prints a line like: `VIOLATION  type=no_hardhat  conf=0.87`
6. FPS is shown in the top-left corner of the window
7. Press `q` to quit, `s` to save a snapshot

That's it. Everything else (database, SMS, dashboard) is Phases 2–4.

---

## 3. ML Concepts You Need First

Before reading the code, you need to understand what the AI model is doing. This section explains it without math.

### What is Object Detection?

Object detection answers two questions at once:
- **What objects are in this image?** (classification)
- **Where exactly are they?** (localization — a rectangle around each object)

A regular image classifier just says "this is a photo of a dog." Object detection says "there is a dog at coordinates [120, 45, 340, 290], and a person at [400, 10, 600, 400]."

### What is YOLO?

YOLO stands for "You Only Look Once." It's the name of a family of object detection models.

The "only look once" means: one forward pass through the neural network produces all detections at the same time. Older approaches would scan the image hundreds of times with a sliding window — slow. YOLO does it in one shot, which is fast enough for real-time video (30 frames per second).

In plain terms: you hand YOLO an image and it hands you back a list of everything it found, where each thing is, and how confident it is.

### What is a "Pre-Trained Model"?

A model is just a file of numbers (called "weights"). These numbers are tuned through training — showing the model millions of example images and correcting it when it gets things wrong, over and over, until it's accurate.

Training from scratch takes days or weeks of GPU time on millions of images.

A **pre-trained model** already has its weights tuned — someone else did the training. Our `ppe_v1.pt` file is a YOLO model that was:
1. First trained on the COCO dataset (80 common objects: dogs, cars, people, etc.)
2. Then fine-tuned on 2,801 construction site photos specifically labeled for PPE

Result: it knows what a hard hat looks like, what "no hard hat" looks like, what a safety vest looks like, etc. We just downloaded it and use it.

### What is a Bounding Box?

When YOLO finds an object, it returns a **bounding box** — a rectangle that surrounds the object. The box is described by four coordinates:

```
(x1, y1) ─────────────────────────────┐
          │                           │
          │     Worker without hat    │
          │                           │
          └──────────────────────── (x2, y2)
```

`x1, y1` is the top-left corner; `x2, y2` is the bottom-right corner. Everything inside that rectangle is "the object."

In code (from `detector.py`), these are accessed via `box.xyxy` — a tensor containing `[x1, y1, x2, y2]`.

### What is a Confidence Score?

YOLO doesn't just say "this is a hard hat." It says "I am 87% sure this is a hard hat." That 87% is the confidence score.

We set a **confidence threshold** of 0.6 (60%). Any detection below 60% confidence is thrown away — too uncertain to act on.

- Too low (e.g., 0.3): lots of false positives (baseball caps flagged as missing helmets)
- Too high (e.g., 0.9): misses real violations because the model is rarely that certain
- 0.6 is the standard starting point; you tune it once you have real customer footage

### What is a Class?

The model was trained on 10 different types of objects (classes):

| Index | Class Name      | Meaning                               |
|-------|-----------------|---------------------------------------|
| 0     | Hardhat         | Worker IS wearing a hard hat ✓        |
| 1     | Mask            | Worker IS wearing a mask ✓            |
| 2     | NO-Hardhat      | Worker is NOT wearing a hard hat ✗    |
| 3     | NO-Mask         | Worker is NOT wearing a mask ✗        |
| 4     | NO-Safety Vest  | Worker is NOT wearing a vest ✗        |
| 5     | Person          | A person (generic)                    |
| 6     | Safety Cone     | An orange safety cone                 |
| 7     | Safety Vest     | Worker IS wearing a vest ✓            |
| 8     | machinery       | Heavy machinery                       |
| 9     | vehicle         | A vehicle                             |

Cordon Safety only cares about classes 2, 3, and 4 — the negative/violation ones. Classes 0, 1, 7 mean the worker is compliant; we draw their boxes (for visual confirmation) but don't fire alerts.

### What is mAP?

mAP (mean Average Precision) is the standard accuracy score for object detection models. Our model reports mAP@50 of 84.1%, precision 92.7%, recall 77.4%.

- **Precision 92.7%**: when the model says "that's a violation," it's right 92.7% of the time (low false positives)
- **Recall 77.4%**: of all real violations, the model catches 77.4% (it misses about 1 in 4)
- **mAP 84.1%**: an average of precision across all confidence thresholds and all classes

For a construction site, missing ~23% of violations (recall) is acceptable for a first version. Better than zero, which is what walkthroughs achieve on most days.

---

## 4. Python Concepts Used in This Codebase

If you're rusty on Python, here are the specific patterns used in Cordon Safety code.

### Classes

A class is a blueprint for creating objects. It bundles data and functions together.

```python
class PPEDetector:           # "PPEDetector" is the class name
    def __init__(self, model_path):    # __init__ runs when you CREATE the object
        self.model = YOLO(model_path)  # self.model stores data ON the object
    
    def predict(self, frame):          # predict() is a function ON the object
        return self.model.predict(frame)
```

When you write `detector = PPEDetector("models/ppe_v1.pt")`, Python runs `__init__` and creates one specific detector object. You can then call `detector.predict(frame)` on it.

### Dataclasses

`@dataclass` is a shortcut to create a class that mostly stores data. Instead of writing `__init__` manually, Python generates it for you.

```python
@dataclass
class ViolationTracker:
    debounce_frames: int = 5    # default value of 5
    cooldown_seconds: int = 60  # default value of 60
```

This is equivalent to writing `def __init__(self, debounce_frames=5, cooldown_seconds=60): ...` manually.

### Type Hints

`def predict(self, source, confidence: float = 0.6)` — the `: float` tells you what type is expected. `= 0.6` is the default value. Python doesn't enforce these at runtime, but they help you read the code and let tools catch mistakes.

### Modules and Imports

Each `.py` file is a module. When you write `from detector import PPEDetector`, Python finds `detector.py` in the same folder and pulls out the `PPEDetector` class. The file doesn't run again every time you import it — Python caches it.

### Logging vs Print

`print()` just dumps text. `logging.info()` adds a timestamp, the log level, and lets you easily turn verbose output on/off. Production code uses logging. Our terminal output like `2026-04-30 14:32:01 [INFO] VIOLATION type=no_hardhat conf=0.87` comes from the logging system.

### `if __name__ == "__main__":`

Every Python file can be both a **module** (imported by another file) and a **script** (run directly). The `if __name__ == "__main__":` block only runs when you execute the file directly (`python src/main.py`), NOT when another file imports it. This prevents side effects when importing.

### f-strings

```python
label = f"FPS: {fps:.1f}  |  Active violations: {num_violations}"
```

The `f` prefix means "format string." Anything inside `{}` is evaluated as Python. `fps:.1f` means "show fps with 1 decimal place."

### Context Managers (`with` statements)

Not used heavily in Phase 1, but you'll see them with file handling and database connections: `with open(file) as f:`. The `with` block ensures the file is closed properly even if an error occurs.

---

## 5. The Detection Service — File by File

All files live in `detection/`. Run every command from inside that folder.

### 5.1 `pyproject.toml`

**What it is:** The project configuration file. Modern Python equivalent of `requirements.txt` but more powerful. Tells Python what this project is called, what version it requires, and what external libraries it depends on.

**Full contents explained:**

```toml
[project]
name = "ppe-detection"          # project name (for pip)
version = "0.1.0"               # current version
description = "PPE detection service using YOLOv8"
requires-python = ">=3.11"      # won't install on Python 3.10 or older

[project.dependencies]
# These are installed when you run: pip install -e .
ultralytics    # the YOLO model library
opencv-python  # camera + image frame handling
python-dotenv  # reads .env files into environment variables
supabase       # Supabase database client (Phase 2+)
boto3          # AWS SDK: S3 + SES (Phase 2+)
twilio         # SMS alerts (Phase 3+)

[project.optional-dependencies]
dev = [
    pytest   # test runner
    ruff     # fast Python linter (catches bugs + style issues)
]
```

**How to make it work:**
```powershell
cd detection
python -m venv venv           # create isolated Python environment
venv\Scripts\activate         # activate it (Windows)
pip install -e ".[dev]"       # install all dependencies including dev tools
```

The `-e` flag means "editable" — you can change source files and the install picks up changes without reinstalling.

**What `venv` is:** A virtual environment is an isolated Python installation just for this project. It prevents library version conflicts between projects. Always activate it before running anything.

---

### 5.2 `.env.example` / `.env`

**What it is:** Environment variables are named values that your program reads at runtime, kept outside the code. The `.env` file stores them on your local machine. `.env.example` is a safe template (no real values) committed to git.

**Why this pattern exists:** If you put your AWS key directly in the code and push to GitHub, anyone who sees the repo can use your AWS account. Environment variables keep secrets out of the codebase.

**Full contents explained:**

```bash
# Supabase (your database)
SUPABASE_URL=                          # the URL of your Supabase project
SUPABASE_ANON_KEY=                     # public key, safe for frontend
SUPABASE_SERVICE_ROLE_KEY=             # admin key — backend ONLY, never in frontend

# AWS (photo storage + email)
AWS_REGION=ca-central-1                # Canadian data center (legal requirement)
AWS_ACCESS_KEY_ID=                     # your AWS identity
AWS_SECRET_ACCESS_KEY=                 # your AWS password
S3_BUCKET_NAME=cordon-safety-violations-dev   # the S3 "folder" where photos go

# Twilio (SMS)
TWILIO_ACCOUNT_SID=                    # your Twilio account ID
TWILIO_AUTH_TOKEN=                     # your Twilio password
TWILIO_FROM_NUMBER=                    # the Twilio phone number sending SMS
TWILIO_TO_NUMBER=                      # the supervisor's phone receiving SMS

# Detection tuning
DETECTION_CONFIDENCE_THRESHOLD=0.6    # minimum confidence to count a detection
DEBOUNCE_FRAMES=5                      # frames in a row before trusting a violation
COOLDOWN_SECONDS=60                    # seconds before alerting on same violation again
```

**Phase 1 note:** You don't need to fill ANY of these for Phase 1. The detection loop reads from `.env` but falls back gracefully. Supabase/Twilio/AWS are only needed in Phases 2–3.

**How `python-dotenv` works:** At the top of `main.py` and `storage.py` you'll see `load_dotenv()`. This reads the `.env` file and adds each line to Python's `os.environ` dictionary, so `os.environ["SUPABASE_URL"]` returns whatever you set.

---

### 5.3 `src/__init__.py`

**What it is:** An empty file that tells Python "this folder is a package." Without it, you can't import files from this folder as a module. In Python 3.3+ it's technically optional for some import styles, but it's convention to include it.

**Contents:** Empty. No action needed.

---

### 5.4 `src/detector.py`

**What it is:** The brain of the detection service. Wraps the YOLO model and provides two clean methods: `predict()` (run the model) and `find_violations()` (filter results to only the "bad" detections).

**Why it exists as its own file:** `main.py` shouldn't need to know about ultralytics internals. It calls `detector.predict()` and `detector.find_violations()` — clean, simple. If we ever switch from YOLO to a different model, we only change this one file.

**Line-by-line walkthrough:**

```python
from ultralytics import YOLO
```
Imports the YOLO class from the ultralytics library. This is the class that loads the `.pt` weights file and runs inference.

```python
VIOLATION_CLASSES = {"NO-Hardhat", "NO-Safety Vest", "NO-Mask"}
```
A Python set (like a list but unordered and no duplicates) of the class names we care about. A set is used instead of a list because checking `"NO-Hardhat" in VIOLATION_CLASSES` is O(1) — instant — regardless of size. With a list, Python checks every element one by one.

This is defined at **module level** (outside any class), meaning it's a constant available to anyone who does `from detector import VIOLATION_CLASSES`.

```python
class PPEDetector:
    def __init__(self, model_path: str = "models/ppe_v1.pt"):
        self.model = YOLO(model_path)
        self.class_names = self.model.names
```
The constructor loads the model file from disk. `YOLO(model_path)` reads the `.pt` file, loads all the neural network weights into memory, and (if CUDA is available) puts them on the GPU. This takes a few seconds the first time.

`self.model.names` is a dictionary like `{0: "Hardhat", 1: "Mask", 2: "NO-Hardhat", ...}` — the model's built-in mapping of index numbers to human-readable class names.

```python
    def predict(self, source, confidence: float = 0.6):
        results = self.model.predict(source=source, conf=confidence, verbose=False)
        return results
```
Runs inference on `source`, which can be:
- A NumPy array (a webcam frame)
- A file path string (an image on disk)
- An RTSP URL (an IP camera stream)

`conf=confidence` sets the threshold — any detection below this is discarded before we even see it.

`verbose=False` stops ultralytics from printing debug lines every frame (it would flood the terminal).

Returns a list of `Result` objects. We always have one camera, so we always use `results[0]`.

```python
    def find_violations(self, result) -> list[dict]:
```
`-> list[dict]` is a return type annotation. This function always returns a list of dictionaries (or an empty list).

```python
        if result.boxes is None:
            return violations
```
Guard clause: if the model found zero objects, `result.boxes` is `None`. Return early before trying to iterate over nothing (that would crash).

```python
        for box in result.boxes:
            cls_id = int(box.cls[0])
            cls_name = self.class_names[cls_id]
            conf = float(box.conf[0])
```
For each detected box:
- `box.cls` is a tensor (GPU/CPU array) containing the class index. `box.cls[0]` gets the first (and only) element. `int(...)` converts from tensor to a regular Python integer.
- `self.class_names[cls_id]` looks up the human name (e.g., `2 → "NO-Hardhat"`)
- `box.conf[0]` is the confidence score as a tensor. `float(...)` converts it to a regular Python float.

```python
            if cls_name in VIOLATION_CLASSES:
                v_type = cls_name.lower().replace("-", "_").replace(" ", "_")
                violations.append({"violation_type": v_type, "confidence": conf})
```
Only keep boxes whose class is one of the three violation types. Then normalize the name: `"NO-Hardhat"` → `"no_hardhat"`. This snake_case format is what gets stored in the database.

**What the function returns:**
```python
[
    {"violation_type": "no_hardhat", "confidence": 0.87},
    {"violation_type": "no_safety_vest", "confidence": 0.74},
]
```
Or `[]` if nobody is in violation.

---

### 5.5 `src/debounce.py`

**What it is:** Prevents alert spam. Implements two independent spam filters:

1. **Debounce** — requires N consecutive frames with the same violation before trusting it
2. **Cooldown** — after firing an alert, wait X seconds before firing again for the same type

**Why both?**
- A single blur or partial occlusion can cause one false "NO-Hardhat" frame. Without debounce: instant false alarm.
- Even with debounce, a worker standing without a hard hat for 5 minutes would trigger every second. Without cooldown: supervisor's phone gets 300 texts.
- Debounce = frame-level noise filter. Cooldown = event-level deduplication. They solve different problems.

**Line-by-line walkthrough:**

```python
from collections import deque
```
`deque` is a "double-ended queue" — a list optimized for adding/removing from both ends. We use `deque(maxlen=N)` which automatically drops the oldest element when full. Perfect for a sliding window of recent frames.

```python
from dataclasses import dataclass, field
```
`field(default_factory=lambda: {})` is needed for mutable defaults in dataclasses. You can't write `recent: dict = {}` in a dataclass because Python would share the same `{}` across all instances — a classic Python gotcha. `default_factory` creates a fresh `{}` for each new instance.

```python
@dataclass
class ViolationTracker:
    debounce_frames: int = 5
    cooldown_seconds: int = 60
    recent: dict[str, deque] = field(default_factory=lambda: {})
    last_alert: dict[str, float] = field(default_factory=lambda: {})
```
`recent` maps violation type → deque of timestamps: `{"no_hardhat": deque([1.234, 1.267, 1.301, ...], maxlen=5)}`

`last_alert` maps violation type → timestamp of last alert: `{"no_hardhat": 1714500000.0}`

```python
    def should_alert(self, violation_type: str) -> bool:
        now = time()
```
`time()` returns the current Unix timestamp (seconds since 1970-01-01). It's a float with microsecond precision.

```python
        if violation_type not in self.recent:
            self.recent[violation_type] = deque(maxlen=self.debounce_frames)
        self.recent[violation_type].append(now)
```
First time we see this violation type: create a new deque for it. Then record the current timestamp. The deque automatically discards the oldest entry once it hits `maxlen`.

```python
        if len(self.recent[violation_type]) < self.debounce_frames:
            return False
```
If we haven't seen enough frames yet (deque not full), don't alert. This is the debounce check — Part 1.

```python
        if now - self.recent[violation_type][0] > 1.0:
            return False
```
The deque is full, but are all N frames recent? `self.recent[...][0]` is the oldest timestamp in the window. If the oldest is more than 1 second ago, the frames weren't consecutive — someone just walked into frame slowly. Require N frames within 1 second. This is debounce — Part 2.

```python
        last = self.last_alert.get(violation_type, 0)
        if now - last < self.cooldown_seconds:
            return False
```
`.get(key, 0)` returns 0 if the key doesn't exist (meaning we've never alerted). If the last alert was within the cooldown window, block it.

```python
        self.last_alert[violation_type] = now
        return True
```
Record this alert timestamp. Return `True` — the caller should fire the alert.

**The key insight:** `should_alert()` is called once per frame, per violation type detected. It's stateful — the `recent` and `last_alert` dictionaries remember history across calls. The `ViolationTracker` object must live for the entire duration of the detection loop (created once in `main.py`, reused every frame).

---

### 5.6 `src/storage.py`

**What it is:** Handles saving violation evidence. Two destinations: Supabase (Postgres database) for metadata, AWS S3 for the actual snapshot image.

**Phase relevance:** Not used in Phase 1. Phase 2 wires this in.

**Important security note:** This file uses `SUPABASE_SERVICE_ROLE_KEY`. This is an admin key that bypasses all security rules. It's correct for a trusted backend service but would be catastrophic in frontend code. The dashboard uses `SUPABASE_ANON_KEY` instead. This distinction is a security fundamental — every interviewer will ask about it.

**Walkthrough of `upload_snapshot()`:**

```python
def upload_snapshot(frame_bytes: bytes, camera_id: str) -> str:
```
Takes raw JPEG bytes (the frame, encoded by OpenCV) and the camera's UUID. Returns the S3 URL of the saved image.

```python
    key = f"violations/{camera_id}/{datetime.utcnow().isoformat()}.jpg"
```
S3 doesn't have folders, just keys (like file paths). This creates a path like `violations/uuid-here/2026-04-30T14:32:01.jpg`. Using the timestamp in the key makes each upload unique.

```python
    s3.put_object(
        Bucket=os.environ["S3_BUCKET_NAME"],
        Key=key,
        Body=frame_bytes,
        ContentType="image/jpeg"
    )
```
Uploads the bytes to S3. `ContentType` tells browsers how to render it when accessed directly.

```python
    return f"https://{os.environ['S3_BUCKET_NAME']}.s3.amazonaws.com/{key}"
```
Returns a direct URL. **Important:** the bucket is private, so this URL won't work in a browser without a signed URL. The dashboard generates signed URLs with an expiry time. This function just records where the file lives.

**Why one client per process, not per call:**
```python
# Create one client per process, not per call (avoids connection pool exhaustion)
# supabase = get_supabase()  ← uncomment in Phase 2
```
Database connections are expensive. Creating a new connection for every frame would exhaust Supabase's connection limit (100 on the free tier) instantly. Create one connection at startup, reuse it throughout.

---

### 5.7 `src/alerts.py`

**What it is:** Sends two types of notifications: immediate SMS via Twilio (for real-time violations) and daily email digests via AWS SES (for end-of-day summaries).

**Phase relevance:** Not used in Phase 1. Phase 3 wires this in.

**Walkthrough of `send_violation_sms()`:**

```python
    body = (
        f"[Cordon Safety] {violation_type.replace('_', ' ').upper()} "
        f"at {camera_name} — view: {image_url[:50]}..."
    )
```
Formats the SMS text. `violation_type.replace('_', ' ').upper()` converts `"no_hardhat"` → `"NO HARDHAT"`. `image_url[:50]` takes only the first 50 characters of the URL (SMS has 160-character limit; full S3 URLs are often 100+ chars).

```python
    except Exception as e:
        logger.error(f"Failed to send SMS: {e}")
        return None
```
Fail silently with a log. If Twilio is down, we don't want the detection loop to crash — we just miss the SMS. Phase 5 adds a retry queue.

**About AWS SES sandbox mode:** When you first set up SES, you're in "sandbox mode." In sandbox mode, you can only send emails to addresses you've explicitly verified in the AWS console. This is annoying for testing but protects AWS from being used for spam. Request production access before any customer pilot.

---

### 5.8 `src/main.py`

**What it is:** The entry point. The script you actually run. It orchestrates all the other pieces.

**Phase 1 version does:**
1. Load the PPE model
2. Open the webcam
3. Loop forever: grab frame → run model → draw boxes → check violations → show window
4. Log violations to terminal
5. Quit on `q`, save snapshot on `s`

**Line-by-line walkthrough:**

```python
from detector import PPEDetector, VIOLATION_CLASSES
```
Imports the class AND the module-level constant. `VIOLATION_CLASSES` is used only in the startup banner (to show the user what we're watching for).

```python
load_dotenv()
```
Reads `.env` and loads all variables into `os.environ`. Must be called before any `os.environ["..."]` access. If `.env` doesn't exist, this is a no-op (no error).

```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
```
Sets up the logging system. Every `logger.info(...)` call will produce output formatted like:
`2026-04-30 14:32:01,234 [INFO] VIOLATION type=no_hardhat conf=0.87`

`level=logging.INFO` means show INFO, WARNING, and ERROR messages. DEBUG messages are hidden.

```python
MODEL_PATH = "models/ppe_v1.pt"
CONFIDENCE = 0.6
CAMERA_INDEX = 0
```
Configuration constants at module level. Changing these is easier than hunting through the code. `CAMERA_INDEX = 0` is your laptop's default webcam. When you have an IP camera, this becomes an RTSP URL string like `"rtsp://admin:password@192.168.1.100:554/stream"`.

```python
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        logger.error("Could not open camera...")
        return
```
`VideoCapture` opens the camera. `.isOpened()` returns False if:
- Windows privacy settings block Python from accessing the camera
- Another application is already using the camera
- The camera index is wrong

The error message includes how to fix the most common Windows issue.

```python
    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            continue
```
`cap.read()` returns `(success, frame)`. `ret` is True if the frame was captured successfully. `frame` is a NumPy array of shape `(height, width, 3)` — a grid of pixels, each with 3 color values (Blue, Green, Red — note: OpenCV uses BGR, not RGB).

Skipping bad frames prevents crashes from temporary glitches.

```python
        results = detector.predict(frame, confidence=CONFIDENCE)
        violations = detector.find_violations(results[0])
        annotated = results[0].plot()
```
Three lines that do the heavy lifting:
1. Run YOLO inference on the frame → get Result objects
2. Filter to only violation detections → list of dicts
3. Draw bounding boxes and labels onto a copy of the frame → `annotated` is a new NumPy array

`results[0].plot()` returns the frame with colored boxes drawn on it. It's a method built into ultralytics — you don't need to draw the boxes yourself.

```python
        frame_count += 1
        if frame_count % 30 == 0:
            fps = 30 / (time.time() - fps_start)
            fps_start = time.time()
```
FPS calculation. `%` is the modulo operator — it gives the remainder of division. `frame_count % 30 == 0` means "every 30th frame." We measure how long it took to process 30 frames, divide: `30 frames / elapsed seconds = frames per second`. Reset the timer.

We don't calculate every frame to avoid the FPS display flickering wildly.

```python
        cv2.putText(annotated, label, (10, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.85, color, 2, cv2.LINE_AA)
```
Draws text onto the frame. Parameters:
- `(10, 32)`: pixel position (x=10 from left, y=32 from top)
- `cv2.FONT_HERSHEY_SIMPLEX`: font style
- `0.85`: font scale (size)
- `color`: BGR tuple — `(0, 0, 220)` is red, `(0, 180, 0)` is green
- `2`: thickness in pixels
- `cv2.LINE_AA`: anti-aliasing (smooth edges)

```python
        cv2.imshow("Cordon Safety — Phase 1 Detection", annotated)
        key = cv2.waitKey(1) & 0xFF
```
`imshow` renders the frame in a window. The window title is the first argument.

`waitKey(1)` is critical — it processes GUI events and keyboard input. The `1` means "wait 1 millisecond." Without this call, the window freezes. `& 0xFF` is a bitmask to handle some edge cases with 64-bit systems returning values > 255.

```python
    cap.release()
    cv2.destroyAllWindows()
```
Always release the camera and close windows when done. Without `cap.release()`, the camera stays locked and you'd need to restart Python to use it again.

---

## 6. The Tests — File by File

Tests verify that individual pieces of logic work correctly without running the whole system. Phase 1 tests don't require a GPU, a camera, or a real model file — they use mock objects.

### 6.1 `tests/conftest.py`

**What it is:** pytest's auto-loaded configuration file. Anything in `conftest.py` runs before tests.

**What it does:**
```python
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
```
Adds `detection/src/` to Python's module search path. Without this, pytest wouldn't find `detector.py` when test files try to `import detector`. `Path(__file__)` is the path of this file itself (`tests/conftest.py`); `.parent.parent` goes up two levels to `detection/`; then `/ "src"` appends the folder.

**How to run tests:**
```powershell
cd detection
venv\Scripts\activate
pytest                      # all tests
pytest tests/test_detector.py        # one file
pytest tests/test_detector.py::test_no_hardhat_is_flagged  # one test
pytest -v                   # verbose output (shows each test name)
```

### 6.2 `tests/test_detector.py`

**What it is:** Tests for `PPEDetector.find_violations()` — the function that decides which detections are violations.

**The core challenge:** `PPEDetector.__init__` calls `YOLO(model_path)`, which would try to load `ppe_v1.pt`. In tests, we don't want to load a real model (slow, requires the file). We use `unittest.mock.patch` to replace `YOLO` with a fake during the test.

**How `@patch("detector.YOLO")` works:**
```python
@patch("detector.YOLO")
def test_no_hardhat_is_flagged(mock_yolo_cls):
    from detector import PPEDetector
    mock_yolo_cls.return_value = MagicMock(names=CLASS_NAMES)
    detector = PPEDetector(model_path="fake.pt")
```
`@patch("detector.YOLO")` temporarily replaces the `YOLO` symbol inside `detector.py` with a `MagicMock` object. `mock_yolo_cls` is that fake. When `PPEDetector.__init__` calls `YOLO(model_path)`, it's calling the mock instead of the real thing. We set `mock_yolo_cls.return_value` to a fake model object with `names=CLASS_NAMES`.

**How fake boxes are created:**
```python
def _make_box(cls_id: int, conf: float) -> MagicMock:
    box = MagicMock()
    box.cls = [cls_id]
    box.conf = [conf]
    return box
```
`MagicMock()` creates an object that pretends to be anything. We set `.cls` and `.conf` to match what real YOLO Box objects look like, so `find_violations()` works exactly as it would with real detections.

**What the tests verify:**
- `NO-Hardhat` detection → `violation_type = "no_hardhat"` with correct confidence
- `NO-Safety Vest` detection → `violation_type = "no_safety_vest"`
- `Hardhat` detection (safe) → no violations returned
- Empty frame (no boxes) → no violations returned
- Mixed frame (safe + unsafe workers) → only the unsafe ones returned

### 6.3 `tests/test_debounce.py`

**What it is:** Tests for `ViolationTracker.should_alert()` — the debounce + cooldown logic.

**No mocking needed here** — `ViolationTracker` is pure Python with no external dependencies. Tests run instantly.

**What the tests verify:**
- Alert fires only after `debounce_frames` consecutive calls
- After alerting, cooldown blocks immediate re-alert
- Two different violation types have independent counters
- A single frame never triggers an alert
- Calling N-1 times (just under threshold) never triggers

---

## 7. How All the Files Connect

Here is the complete dependency graph for Phase 1:

```
main.py
  │
  ├── imports PPEDetector, VIOLATION_CLASSES  ──→  detector.py
  │     │
  │     └── imports YOLO  ─────────────────────→  [ultralytics library]
  │
  ├── imports load_dotenv  ────────────────────→  [python-dotenv library]
  ├── imports cv2  ────────────────────────────→  [opencv-python library]
  ├── imports logging, time, pathlib  ─────────→  [Python standard library]
  │
  │  (Phase 2 additions — NOT wired in Phase 1)
  ├── will import ViolationTracker  ───────────→  debounce.py
  ├── will import upload_snapshot, log_violation  → storage.py
  │     └── imports boto3, supabase  ──────────→  [external libraries]
  └── will import send_violation_sms  ─────────→  alerts.py
        └── imports twilio, boto3  ────────────→  [external libraries]
```

```
tests/
  conftest.py  ──  adds src/ to sys.path, runs before all tests
  
  test_detector.py
    ├── imports from detector (via conftest.py path setup)
    ├── uses unittest.mock to fake YOLO
    └── calls find_violations() with fake boxes
  
  test_debounce.py
    ├── imports from debounce (via conftest.py path setup)
    └── calls should_alert() directly
```

**The "not yet wired" parts:** `storage.py`, `alerts.py`, and `debounce.py` are complete files sitting ready. Phase 1's `main.py` doesn't import them. Phase 2 will add debounce + storage to the loop; Phase 3 adds alerts. The files were written now so the codebase grows incrementally, not in a big-bang Phase 2 scramble.

---

## 8. What Each External Library Actually Does

### `ultralytics`
The official package for YOLO models. You `pip install ultralytics` and it gives you:
- `YOLO("path.pt")` — loads a model
- `model.predict(source)` — runs inference
- `result.plot()` — draws boxes on images
- `result.boxes` — access raw detection data
Under the hood it uses PyTorch for the neural network math.

### `opencv-python` (`cv2`)
OpenCV is a computer vision library. In Cordon Safety it does three things:
1. `cv2.VideoCapture(0)` — opens the webcam and streams frames
2. `cv2.imshow(...)` — displays a frame in a GUI window
3. `cv2.imencode(".jpg", frame)` — converts a NumPy array to JPEG bytes for uploading

It doesn't do any AI — that's ultralytics' job. OpenCV is the plumbing for getting frames in and out.

### `python-dotenv`
Tiny library. Reads a `.env` file and calls `os.environ["KEY"] = "value"` for each line. That's it. Without it, you'd manually set environment variables in PowerShell before running.

### `supabase` (Phase 2+)
The official Python client for Supabase. Wraps REST API calls to your Supabase project. `supabase.table("violations").insert({...}).execute()` sends a POST request to insert a row.

### `boto3` (Phases 2–3+)
AWS's Python SDK. `boto3.client("s3")` gives you an S3 client. `boto3.client("ses")` gives you an email client. Same library, different services.

### `twilio` (Phase 3+)
Twilio's Python SDK. `Client(sid, token).messages.create(body=..., from_=..., to=...)` sends an HTTP request to Twilio's API, which then sends the SMS.

### `pytest`
Test runner. You write functions that start with `test_` and `pytest` finds and runs them. An `AssertionError` in a test = test failed. No error = test passed.

### `ruff`
A very fast Python linter written in Rust. Finds bugs (unused variables, undefined names), style issues (line length), and security problems before you run the code. `ruff check src/` scans the source files.

---

## 9. The GPU Story

Your RTX 4080 has 9,728 CUDA cores — tiny processors optimized for running the same math operation on thousands of numbers simultaneously. Neural network inference is exactly that kind of math.

On CPU (your Intel i9): one YOLO inference takes ~40ms → ~25 FPS max  
On GPU (RTX 4080): one inference takes ~3ms → ~300 FPS cap

For Phase 1 (webcam at 30 FPS), even CPU is fast enough. For a production site with 8 cameras at 30 FPS, GPU is mandatory.

**How YOLO uses the GPU:**

When you call `YOLO("models/ppe_v1.pt")`, ultralytics detects CUDA and automatically loads model weights onto the GPU. If CUDA isn't available, it falls back to CPU silently.

In `detector.py`, the constructor calls `print(f"[detector] Model loaded. Classes: {self.class_names}")` which confirms load. In `main.py`, if you see:
```
GPU: NVIDIA GeForce RTX 4080 ✓
```
...you're running on GPU. If you see the WARNING about CPU, your PyTorch doesn't have CUDA support.

**Fixing CPU-only PyTorch:**
```powershell
# Uninstall regular PyTorch
pip uninstall torch torchvision torchaudio

# Install CUDA 12.x version from pytorch.org
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

Then verify:
```python
import torch
print(torch.cuda.is_available())   # must print True
print(torch.cuda.get_device_name(0))  # must print RTX 4080
```

---

## 10. Step-by-Step: What Happens When You Run `main.py`

This is the exact sequence of events from command to first frame on screen.

1. **`python src/main.py`** — Python finds and executes `main.py`

2. **Module imports** — Python finds `detector.py` (same folder), runs it once, caches it. `YOLO` from ultralytics is imported. `cv2` (OpenCV) is imported.

3. **`load_dotenv()`** — `.env` file is read. If `DETECTION_CONFIDENCE_THRESHOLD=0.6` is in there, it's now in `os.environ`.

4. **`logging.basicConfig(...)`** — future `logger.info(...)` calls know how to format output.

5. **`run_detection()` is called** (because `if __name__ == "__main__"` is true when running directly)

6. **`PPEDetector(model_path="models/ppe_v1.pt")` is called:**
   - `YOLO("models/ppe_v1.pt")` reads the 22MB `.pt` file from disk
   - PyTorch parses the model architecture and loads ~11 million weight numbers
   - If CUDA available: weights are copied to GPU VRAM (fast inference from here)
   - `self.class_names` is set to the 10-class name dictionary
   - Terminal prints: `[detector] Model loaded. Classes: {0: 'Hardhat', ...}`

7. **`cv2.VideoCapture(0)` opens the webcam:** The OS gives Python access to the camera. A buffer of frames starts accumulating in the background.

8. **Startup banner prints** to terminal.

9. **The `while True` loop begins:**

   **Frame N (every ~33ms at 30 FPS):**
   
   a. `cap.read()` — grabs the next frame from the OS camera buffer. Returns a NumPy array of shape `(480, 640, 3)` for a standard webcam (480 pixels tall, 640 wide, 3 color channels BGR).
   
   b. `detector.predict(frame, confidence=0.6)` — the frame (as a NumPy array) is sent through the neural network. On GPU this takes ~3ms. Returns a list with one `Result` object.
   
   c. `detector.find_violations(results[0])` — iterates over detected boxes, keeps only the violation classes, returns a list of dicts. If nobody is in frame, returns `[]`.
   
   d. `results[0].plot()` — ultralytics draws colored rectangles and class labels directly on a copy of the frame. Returns a new NumPy array.
   
   e. FPS is recalculated every 30 frames.
   
   f. `cv2.putText(...)` — draws the "FPS: 28.4 | Active violations: 1" text onto the frame.
   
   g. Any violations are logged to terminal: `2026-04-30 14:32:01 [INFO] VIOLATION type=no_hardhat conf=0.87`
   
   h. `cv2.imshow(...)` — the frame (with boxes and text) is rendered to the window.
   
   i. `cv2.waitKey(1)` — process GUI events, check keyboard.
   
   j. Back to (a).

10. **`q` key pressed:**
    - `break` exits the while loop
    - `cap.release()` returns the camera to the OS
    - `cv2.destroyAllWindows()` closes the window
    - `run_detection()` returns
    - `main.py` exits

---

## 11. Setup: Everything You Need to Run Phase 1

### Prerequisites
- Python 3.11 installed (python.org, add to PATH)
- CUDA Toolkit 12.x installed (nvidia.com/cuda) — for GPU
- The repo cloned

### Step 1: Verify Python
```powershell
python --version   # must say 3.11.x
```

### Step 2: Create and activate virtual environment
```powershell
cd detection
python -m venv venv
venv\Scripts\activate
# You should see (venv) in your prompt
```

### Step 3: Install dependencies
```powershell
pip install -e ".[dev]"
# This installs: ultralytics, opencv-python, python-dotenv, supabase, boto3, twilio, pytest, ruff
# Takes 3-5 minutes — ultralytics pulls in PyTorch which is large
```

### Step 4: Verify GPU
```powershell
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
# Must print: True NVIDIA GeForce RTX 4080
```

If it prints `False`, reinstall PyTorch with CUDA support:
```powershell
pip uninstall torch torchvision torchaudio -y
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### Step 5: Confirm the model file exists
```powershell
ls models/ppe_v1.pt
# Should show the file. If missing, re-download from Roboflow.
```

### Step 6: Run the detection loop
```powershell
python src/main.py
```

A window should appear with your webcam feed. Bounding boxes should appear around people. If you're not wearing a hard hat, a red "NO-Hardhat" box should appear.

### Step 7: Run the tests
```powershell
pytest
# Should show: 10 passed in 0.XXs
```

### Common Problems

| Problem | Cause | Fix |
|---------|-------|-----|
| `ModuleNotFoundError: No module named 'ultralytics'` | venv not activated | `venv\Scripts\activate` |
| `Could not open camera` | Windows privacy setting | Settings → Privacy → Camera → allow |
| Black screen in window | Camera taken by another app | Close Teams/Zoom/etc. |
| Very low FPS (< 5) | Running on CPU, not GPU | Fix PyTorch CUDA install |
| `FileNotFoundError: models/ppe_v1.pt` | Running from wrong folder | `cd detection` first |

---

## 12. Phase 1 Completion Checklist

Use this to validate Phase 1 is done before moving to Phase 2.

- [ ] `python src/main.py` opens a window with live webcam feed
- [ ] Bounding boxes and class labels appear around detected objects
- [ ] `NO-Hardhat` box appears when you remove your hat
- [ ] FPS counter shows in top-left (should be 20+ FPS on RTX 4080)
- [ ] Terminal prints `VIOLATION type=no_hardhat conf=X.XX` when hat removed
- [ ] `q` key quits cleanly (window closes, no error in terminal)
- [ ] `s` key saves a snapshot to `docs/phase1_snapshot.jpg`
- [ ] `pytest` passes all tests (10 tests, no failures)
- [ ] You can answer the Phase 1 interview questions from BUILD_PATHWAY.md aloud

**Deliverable per BUILD_PATHWAY.md:** Record a 30-second screen capture of the detection running (with and without your hat). Save it as `docs/phase1_demo.mp4`. Use OBS, Windows Game Bar (`Win + G`), or ShareX to record.

---

## 13. What the Next Phases Add

**Phase 2** wires in `debounce.py` and `storage.py`:
- `ViolationTracker.should_alert()` is called inside the detection loop
- When it returns `True`, `upload_snapshot()` saves the frame to S3 and `log_violation()` inserts a row into Supabase
- You'll be able to see violations in Supabase Studio's table view

**Phase 3** wires in `alerts.py`:
- `send_violation_sms()` is called after a violation is logged
- Your phone gets a text within 5 seconds of removing your hat on webcam

**Phase 4** builds the Next.js dashboard:
- `ViolationFeed` component subscribes to Supabase Realtime
- New violations appear in the browser instantly when the Python service logs them
- Supervisor can click a violation, see the photo (via S3 signed URL), and mark it resolved

**Phase 5** polishes for Demo Day:
- Custom domain
- Landing page
- Demo mode (pre-seeded fake violations for when you can't run the webcam live)
- Brand polish

Each phase adds one layer. Nothing from Phase 1 breaks when Phase 2 is added — `main.py` just imports more modules and makes more function calls at the right moment.
