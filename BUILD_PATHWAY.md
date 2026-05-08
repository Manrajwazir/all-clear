# All Clear â€” MVP Build Pathway

> A learn-as-you-build guide. Every phase explains *why*, not just *what*. By the end you'll have a working MVP **and** be able to defend every architectural decision in an interview.

**Last updated:** April 28, 2026
**Co-Founder:** Manraj Singh Wazir (backend + cloud + co-owning ML)
**Co-Founder:** Xavion (sales + industry validation now, ML lead post-MVP, Co-owning Full-Stack)
**Target Demo Day:** May 12, 2026
**Repo visibility:** Private until Demo Day, then evaluated for open-source

---

## Table of Contents

1. [Project Context](#1-project-context)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites & Setup](#3-prerequisites--setup)
4. [Phase 0 â€” Setup & Reading](#phase-0--setup--reading-day-1-3-hours)
5. [Phase 0.5 â€” Python Refresh](#phase-05--python-refresh-day-2-2-hours)
6. [Phase 1 â€” Detection Loop on Webcam](#phase-1--detection-loop-on-webcam-days-3-4-6-hours)
7. [Phase 2 â€” Violation Logger](#phase-2--violation-logger-days-5-6-6-hours)
8. [Phase 3 â€” Alert Pipeline (Twilio)](#phase-3--alert-pipeline-days-7-8-5-hours)
9. [Phase 4 â€” Supervisor Dashboard](#phase-4--supervisor-dashboard-days-9-12-12-hours)
10. [Phase 5 â€” Polish for Demo Day](#phase-5--polish-for-demo-day-days-13-14-6-hours)
11. [The ML Co-Ownership Model](#the-ml-co-ownership-model)
12. [Edge Cases & Known Issues](#edge-cases--known-issues)
13. [Legal: AGPL & Privacy](#legal-agpl--privacy)
14. [What's Deliberately NOT in MVP](#whats-deliberately-not-in-mvp)
15. [Resources Index](#resources-index)

---

## 1. Project Context

### What we're building
All Clear is a SaaS product that watches existing IP cameras on a construction site and detects PPE violations â€” workers without hard hats, missing vests, entering restricted zones â€” in real time. When it detects a violation, it logs it with a timestamp and a photo, and fires an SMS alert to the site supervisor.

### Why this exists
A single workplace incident on an Alberta oilsands or industrial site can disqualify a contractor from $500K-$2M of work because their TRIR (Total Recordable Incident Rate) breaks the operator's prequalification threshold. Today, sites manage compliance with a part-time safety person doing weekly walkthroughs and foremen filling out paper hazard observations â€” 5-10 hours/week of paperwork per site. All Clear automates the evidence layer.

### Why we can build this as a 2-person student team
- The technology is genuinely buildable: pre-trained YOLO models on construction PPE datasets achieve 87% mAP out of the box.
- The market is validated: CompScience ($37M raised), Voxel ($83M raised) prove the model works in the US.
- We have a Canadian gap: SALUS (140K workers) does paperwork but no AI vision. Procore and HammerTech are enterprise-priced and ignore the Alberta mid-market.
- Co-founder has industry contacts; Edmonton Unlimited Student Founders gives us program backing through Aug 19.

### What "MVP" means here
End of 14-day build, we have:
- A working detection loop that flags missing hard hats from a webcam in real time
- Every violation logged to a Postgres database with a photo
- SMS alerts firing within 5 seconds of a violation
- A supervisor dashboard showing all violations, with "resolved / false positive" workflows
- A landing page and demo video that can be sent to a real GC for feedback

### What MVP is NOT
- Production-ready (would need 6+ months of hardening)
- Multi-tenant (single customer assumed)
- Edge-deployed (runs on Manraj's laptop; pilot site adds edge device later)
- Commercially licensed (AGPL issue resolved before customer #1 â€” see Â§13)

---

## 2. Architecture Overview

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     CONSTRUCTION SITE                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                              â”‚
â”‚  â”‚ IP Camera â”‚â”€â”€â”€â”€ RTSP / webcam â”€â”€â”€â”€â”                      â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                       â”‚                      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                       â”‚
                                       â–¼
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â”‚  DETECTION SERVICE (Python)        â”‚
              â”‚  - OpenCV captures frames          â”‚
              â”‚  - YOLO11 runs inference           â”‚
              â”‚  - Debounce + cooldown logic       â”‚
              â”‚  - Writes to Supabase + S3         â”‚
              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â”‚            â”‚                     â”‚
              â–¼            â–¼                     â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”          â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚ Supabase â”‚  â”‚ AWS S3 â”‚          â”‚ Twilio SMS  â”‚
        â”‚ Postgres â”‚  â”‚ images â”‚          â”‚ webhook     â”‚
        â”‚ Realtime â”‚  â”‚        â”‚          â”‚             â”‚
        â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”˜          â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
              â”‚
              â”‚ Realtime WebSocket
              â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚  NEXT.JS DASHBOARD (AWS Amplify)     â”‚
        â”‚  - Live violation feed               â”‚
        â”‚  - Charts (Recharts)                 â”‚
        â”‚  - Auth (Supabase)                   â”‚
        â”‚  - Resolved / false positive UI      â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Why each piece

| Component          | Choice                   | Why                                                                                                                    |
| ------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| ML framework       | **Ultralytics YOLO11**   | Industry standard. Same package every competitor uses. Pre-trained PPE weights available. AGPL-3.0 licensed (see Â§13). |
| Detection language | **Python 3.10+**         | YOLO is Python-native. Anything else is glue code.                                                                     |
| API framework      | **FastAPI**              | Async-first, OpenAPI docs auto-generated, modern Python standard. Replaces Flask.                                      |
| Database           | **Supabase (Postgres)**  | Already proven on GridSync. Realtime WebSockets out of the box save ~20 hours vs. AWS API Gateway WebSockets.          |
| Image storage      | **AWS S3**               | Resume + AWS cert reinforcement. Industry standard. Cheap.                                                             |
| Frontend           | **Next.js 15**           | Already proven on GridSync + PatrolPrep. App Router + server components.                                               |
| Frontend hosting   | **AWS Amplify**          | Matches PatrolPrep architecture. Stronger Alberta enterprise resume than Vercel.                                       |
| UI library         | **shadcn/ui + Tailwind** | Free, copy-paste, looks professional. No design time wasted.                                                           |
| SMS alerts         | **Twilio**               | Industry standard. $20 free credit. Works on day 1.                                                                    |
| Email digests      | **AWS SES**              | Cheap, integrates with rest of AWS stack, supports DVA cert study.                                                     |

### Why we're NOT using these (so you can defend the decision)

| Rejected                    | Why                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Kubernetes                  | Overkill. We have one container, one customer.                                                            |
| Docker (for MVP)            | Adds setup time before first detection. Bring it in for pilot deployment.                                 |
| AWS RDS instead of Supabase | RDS gives managed Postgres but no realtime. Building WebSockets on API Gateway = 20+ hours we don't have. |
| Auth0/Clerk                 | Supabase Auth is built-in. Don't add a vendor.                                                            |
| MLflow/W&B                  | We're not training from scratch. Using pre-trained weights. Add observability when we have our own data.  |
| Pure AWS (no Supabase)      | Pure AWS for the data layer adds 20+ hours of WebSocket plumbing. Pragmatic hybrid wins.                  |

---

## 3. Prerequisites & Setup

### Accounts to create (do these tonight, ~30 min total)

1. **GitHub** â€” already have. Create new private repo `allclear`.
2. **Supabase** â€” [supabase.com](https://supabase.com), free tier. Create new project.
3. **AWS** â€” already have from previous projects.
4. **Twilio** â€” [twilio.com](https://www.twilio.com/try-twilio), free trial gives ~$15 credit + a free Canadian phone number.
5. **Roboflow** â€” [roboflow.com](https://roboflow.com), free tier. Used to download PPE dataset and pre-trained weights.
6. **Vercel/Amplify** â€” already have.

### Tools to install (Windows i9 + RTX 4080)

```powershell
# Python 3.10 or 3.11 (NOT 3.12 yet â€” some ML libs lag)
# Download from python.org, install with "Add to PATH" checked

# Verify
python --version  # should be 3.10.x or 3.11.x

# Node 20 LTS (already have, for Next.js)
node --version

# Git (already have)
git --version

# CUDA Toolkit 12.x for RTX 4080
# Download from NVIDIA: https://developer.nvidia.com/cuda-downloads
# This lets PyTorch use your GPU. Without it, YOLO runs on CPU (10x slower).
```

**Verify GPU works after CUDA install:**
```python
import torch
print(torch.cuda.is_available())  # should print True
print(torch.cuda.get_device_name(0))  # should print "NVIDIA GeForce RTX 4080"
```

If `cuda.is_available()` returns False after CUDA is installed, you have a PyTorch version mismatch â€” uninstall PyTorch and reinstall with the CUDA-matching wheel from [pytorch.org](https://pytorch.org/get-started/locally/).

### Repo structure (set up before Phase 1)

```
allclear/
â”œâ”€â”€ README.md
â”œâ”€â”€ BUILD_PATHWAY.md              # this document
â”œâ”€â”€ NOTES.md                      # learning log, questions, gotchas
â”œâ”€â”€ QUESTIONS.md                  # things to ask Claude / research later
â”‚
â”œâ”€â”€ detection/                    # Python service
â”‚   â”œâ”€â”€ pyproject.toml
â”‚   â”œâ”€â”€ .env.example
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ __init__.py
â”‚   â”‚   â”œâ”€â”€ main.py               # entry point
â”‚   â”‚   â”œâ”€â”€ detector.py           # YOLO inference
â”‚   â”‚   â”œâ”€â”€ debounce.py           # debounce + cooldown logic
â”‚   â”‚   â”œâ”€â”€ storage.py            # Supabase + S3 clients
â”‚   â”‚   â””â”€â”€ alerts.py             # Twilio integration
â”‚   â”œâ”€â”€ models/                   # downloaded PPE weights (gitignored)
â”‚   â””â”€â”€ tests/
â”‚
â”œâ”€â”€ dashboard/                    # Next.js app
â”‚   â”œâ”€â”€ package.json
â”‚   â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ components/
â”‚   â””â”€â”€ lib/
â”‚
â””â”€â”€ docs/
    â”œâ”€â”€ architecture.md
    â””â”€â”€ api.md
```

### Environment variables (the `.env.example` template)

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # backend only, never commit

# AWS (S3 + SES)
AWS_REGION=ca-central-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=allclear-violations-dev

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_TO_NUMBER=  # supervisor's phone, single recipient for MVP

# App config
DETECTION_CONFIDENCE_THRESHOLD=0.6
DEBOUNCE_FRAMES=5
COOLDOWN_SECONDS=60
```

**Critical:** `.env` itself goes in `.gitignore`. Only `.env.example` (with empty values) gets committed. Lose this once and you've leaked AWS credentials.

---

## Phase 0 â€” Setup & Reading (Day 1, 3 hours)

**Goal:** understand what you're building before you write code.

### Concepts to learn

#### What is YOLO actually doing?

YOLO ("You Only Look Once") is a single-pass object detection architecture. Older approaches scanned an image with a sliding window â€” slow. YOLO splits the image into a grid (e.g., 13Ã—13 cells), and for each cell predicts:
- Whether an object is centered there (objectness score)
- The bounding box coordinates relative to the cell
- The class probabilities (helmet? vest? person?)

All in one forward pass through the neural network. That's why it's fast enough for video.

**You should be able to explain in an interview:** "YOLO does object detection in a single forward pass by predicting bounding boxes and class probabilities directly from grid cells, rather than using a region-proposal network like R-CNN. That's why it runs in real time."

#### What does "pre-trained model" mean and why does it matter?

A model is a pile of numerical weights inside a neural network. Training those weights from scratch for object detection takes weeks of GPU time on millions of images.

A *pre-trained* model has weights already learned on a generic dataset (COCO â€” 80 classes of common objects). Someone else has *fine-tuned* it on construction PPE data â€” taken those generic weights and trained them further on PPE images so it now recognizes hard hats, vests, and "no helmet" specifically.

We use someone else's PPE-fine-tuned model. Eventually (post-MVP) we fine-tune it again on Alberta-specific footage.

#### What is mAP and why do we care?

mAP (mean Average Precision) is the standard accuracy metric for object detection. The PPE-trained models we'll use report ~87% mAP@50, meaning at IoU threshold 0.5 (a box is "correct" if it overlaps the ground truth by 50%+), the model gets it right 87% of the time on average across all classes.

For real customers, mAP@50 above 80% is good. Below 70% means too many false positives or missed detections.

### Resources (~3 hours)

1. **Ultralytics Quickstart** ([docs.ultralytics.com/quickstart/](https://docs.ultralytics.com/quickstart/)) â€” read top to bottom, run the bus example.
2. **Roboflow's "What is YOLO" article** ([blog.roboflow.com/guide-to-yolo-models/](https://blog.roboflow.com/guide-to-yolo-models/)) â€” best plain-English explanation.
3. **Construction PPE Dataset on Roboflow Universe** â€” [Construction Site Safety](https://universe.roboflow.com/roboflow-universe-projects/construction-site-safety) (2,801 images, 10 classes including Hardhat, NO-Hardhat, Safety Vest, NO-Safety Vest, Person, Mask, NO-Mask, Safety Cone, machinery, vehicle). Read the dataset page. Note the class names â€” you'll reference them in code.
4. **One pre-trained YOLO PPE GitHub repo** for reference: [VoxDroid/Construction-Site-Safety-PPE-Detection](https://github.com/VoxDroid/Construction-Site-Safety-PPE-Detection) â€” they trained YOLOv8s for 200 epochs to 95% precision / 80% recall. Don't copy their code; read it to understand the shape of a working project.

### Deliverable

Create `NOTES.md` in your repo with:
1. The dataset you chose and why
2. The pre-trained model's reported mAP
3. Your own 3-sentence explanation of YOLO
4. Any questions that came up while reading

### "Stop and verify" checkpoint
Before moving to Phase 0.5, you should be able to answer aloud (no looking):
- What does "pre-trained" mean?
- Why is YOLO faster than R-CNN-style detectors?
- What's mAP@50 and what's a good number?

If you stumble on any of these, re-read. Don't skip.

---

## Phase 0.5 â€” Python Refresh (Day 2, 2 hours)

**Goal:** unstick your Python before Phase 1 throws OpenCV + Ultralytics + Supabase at you simultaneously.

### What you need to refresh

Since you said "rusty," here are the specific things that will trip you up:

1. **Virtual environments** â€” `python -m venv venv` then `venv\Scripts\activate` on Windows
2. **`pyproject.toml` and `pip install -e .`** â€” modern Python project structure, replaces `setup.py`
3. **Type hints** â€” `def foo(x: int) -> str:` â€” FastAPI uses these for validation
4. **Async/await** â€” FastAPI is async-first; you'll see `async def` everywhere
5. **f-strings vs `.format()`** â€” use f-strings: `f"Camera {cam_id} alert at {ts}"`
6. **Context managers** â€” `with open(file) as f:` â€” used everywhere with file/network handles
7. **`logging` module** â€” `print()` is for scripts, `logging.info()` is for services
8. **Environment variables via `python-dotenv`** â€” `from dotenv import load_dotenv; load_dotenv()`

### Resources (~2 hours)

- **Real Python "Python Basics" review** ([realpython.com/python-basics/](https://realpython.com/python-basics/)) â€” skim, focus on the topics above
- **Real Python on f-strings** ([realpython.com/python-f-strings/](https://realpython.com/python-f-strings/))
- **Real Python on async** ([realpython.com/async-io-python/](https://realpython.com/async-io-python/)) â€” skim the first half
- **Optional:** Anthony Sottile's YouTube channel for modern Python idioms ([youtube.com/@anthonywritescode](https://www.youtube.com/@anthonywritescode))

### Deliverable

Create a one-file warmup script `detection/warmup.py` that:
- Reads a value from `.env` using `python-dotenv`
- Defines a function with type hints
- Uses `logging` instead of `print`
- Uses an f-string
- Runs without error

If you can write this without referring to docs, you're ready for Phase 1.

---

## Phase 1 â€” Detection Loop on Webcam (Days 3-4, 6 hours)

**Goal:** point your laptop's webcam at yourself, with and without a hard hat, and watch YOLO draw bounding boxes around what it sees.

This is the *core demo*. Everything else is plumbing around this loop.

### Concepts to learn before coding

#### OpenCV basics
- `cv2.VideoCapture(0)` opens the default webcam (or RTSP URL for IP camera)
- `cap.read()` returns `(success_bool, frame)` where `frame` is a NumPy array (H Ã— W Ã— 3)
- `cv2.imshow()` displays a frame in a window
- `cv2.waitKey(1)` is critical â€” without it, the window freezes

#### Ultralytics YOLO API
```python
from ultralytics import YOLO
model = YOLO("path/to/weights.pt")
results = model(frame)  # results[0] contains the detections
boxes = results[0].boxes  # Box objects with .xyxy, .conf, .cls
```

Each `Box` has:
- `xyxy` â€” `[x1, y1, x2, y2]` corners
- `conf` â€” confidence score 0-1
- `cls` â€” class index (look up in `results[0].names` to get the label)

### Step-by-step

#### Step 1: Get the pre-trained PPE weights

Two options:

**Option A: Roboflow download (easiest)**
1. Go to [Construction Site Safety](https://universe.roboflow.com/roboflow-universe-projects/construction-site-safety)
2. Sign in
3. Click "Models" â†’ find a YOLOv8 or YOLO11 trained version
4. Download the `.pt` file â†’ save to `detection/models/ppe_v1.pt`

**Option B: Train it yourself (good learning, ~1 hour on RTX 4080)**
1. Download the dataset from Roboflow in YOLOv8 format
2. Run training yourself (see Phase 1 supplementary section below)
3. You get a `best.pt` file from the training run

For MVP, do Option A. **Add training to your Phase 4+ ML co-ownership work.**

#### Step 2: Verify YOLO works on a static image first

```python
# detection/src/detector.py
from ultralytics import YOLO

model = YOLO("models/ppe_v1.pt")
results = model("test_image.jpg", conf=0.5)
results[0].show()  # opens window with annotated image
results[0].save(filename="test_output.jpg")
```

Run with a Google image of a construction worker. Confirm boxes appear.

#### Step 3: Wire up webcam

```python
import cv2
from ultralytics import YOLO

model = YOLO("models/ppe_v1.pt")
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    results = model(frame, conf=0.5, verbose=False)
    annotated = results[0].plot()
    
    cv2.imshow("All Clear Detection", annotated)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
```

Run it. Walk in front of webcam. Put on a hat. Take it off. See boxes appear and disappear.

#### Step 4: Understand what you just built

Before moving to Phase 2, sit with the running code and answer:
- What FPS am I getting? (Print `1 / (time.time() - last_time)` each frame)
- What happens if I lower confidence to 0.3? What if I raise it to 0.9?
- What classes does this model know? Print `results[0].names` once.
- What happens if I'm wearing a baseball cap instead of a hard hat? Why?

### Common gotchas

- **"DLL not found" or CUDA errors on first run** â€” PyTorch/CUDA version mismatch. Reinstall PyTorch with the CUDA-matching wheel.
- **Webcam shows black frame** â€” Windows privacy settings may be blocking Python. Settings â†’ Privacy â†’ Camera â†’ Allow desktop apps.
- **Detection is slow (low FPS)** â€” model is running on CPU. Verify `model.device` shows `cuda:0`. If not, force it: `model.to('cuda')`.
- **Bounding boxes are wildly wrong** â€” make sure you're using PPE-trained weights, not the generic COCO weights. The default `yolo11n.pt` doesn't know what a hard hat is.
- **Some frames cause crashes** â€” defensive coding: `if frame is None: continue`.

### Deliverable

A 30-second screen recording of your detection running on your webcam, saved as `docs/phase1_demo.mp4`. This becomes part of your Demo Day pitch.

### Interview-prep questions

After Phase 1, you should be able to answer:
1. "Walk me through how a frame becomes a detection." (Webcam â†’ OpenCV NumPy array â†’ YOLO forward pass â†’ boxes/scores/classes â†’ drawn back on the frame.)
2. "Why did you pick confidence threshold 0.5 specifically?" (Tradeoff: lower = more detections including false positives; higher = misses real violations. 0.5 is the YOLO default and a fair starting point â€” we'll tune later.)
3. "What's running on the GPU vs CPU here?" (YOLO inference runs on CUDA cores; OpenCV image manipulation runs on CPU.)

---

## Phase 2 â€” Violation Logger (Days 5-6, 6 hours)

**Goal:** when the model detects "no helmet" reliably, save the event to Postgres and the snapshot to S3.

This phase is where you make the engineering decisions that separate a demo from a product. Pay attention.

### Concepts to learn

#### Debouncing
A single missed-helmet moment shouldn't fire 30 alerts/second. We require N consecutive frames with the violation before we trust it.

#### Cooldown
Even after debouncing, walking past a camera once shouldn't fire 50 alerts in a minute. After firing, mute that violation type for X seconds.

#### Why both?
Debouncing reduces flicker (frame-level noise). Cooldown reduces alert fatigue (event-level dedup). They solve different problems.

### Database schema

In Supabase SQL editor:

```sql
-- Sites (your customers' physical locations)
create table sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz default now()
);

-- Cameras registered to sites
create table cameras (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id),
  name text not null,
  rtsp_url text,
  created_at timestamptz default now()
);

-- The violations table â€” the heart of the product
create table violations (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid references cameras(id),
  violation_type text not null,  -- 'no_helmet', 'no_vest', etc.
  confidence float not null,
  image_url text,                -- S3 URL
  detected_at timestamptz default now(),
  resolved_at timestamptz,
  resolution_status text,        -- 'pending', 'resolved', 'false_positive'
  notes text
);

-- Index for fast dashboard queries
create index idx_violations_detected_at on violations(detected_at desc);
create index idx_violations_camera on violations(camera_id);

-- Enable Realtime so dashboard gets push updates
alter publication supabase_realtime add table violations;
```

### Step-by-step

#### Step 1: Connect to Supabase from Python

```python
# detection/src/storage.py
import os
from supabase import create_client, Client

def get_supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )
```

Test it: insert a dummy row, query it back, delete it.

#### Step 2: Connect to S3 from Python

```python
# detection/src/storage.py (add)
import boto3
from datetime import datetime

s3 = boto3.client("s3", region_name=os.environ["AWS_REGION"])

def upload_snapshot(frame_bytes: bytes, camera_id: str) -> str:
    key = f"violations/{camera_id}/{datetime.utcnow().isoformat()}.jpg"
    s3.put_object(
        Bucket=os.environ["S3_BUCKET_NAME"],
        Key=key,
        Body=frame_bytes,
        ContentType="image/jpeg"
    )
    return f"https://{os.environ['S3_BUCKET_NAME']}.s3.amazonaws.com/{key}"
```

Make the S3 bucket private. Generate signed URLs for dashboard viewing later.

#### Step 3: Implement the debounce + cooldown logic

```python
# detection/src/debounce.py
from collections import deque
from time import time
from dataclasses import dataclass, field

@dataclass
class ViolationTracker:
    debounce_frames: int = 5
    cooldown_seconds: int = 60
    
    # Track recent frames where each violation type appeared
    recent: dict[str, deque] = field(default_factory=lambda: {})
    # Track when we last alerted on each type
    last_alert: dict[str, float] = field(default_factory=lambda: {})
    
    def should_alert(self, violation_type: str) -> bool:
        now = time()
        
        # Add to recent frames
        if violation_type not in self.recent:
            self.recent[violation_type] = deque(maxlen=self.debounce_frames)
        self.recent[violation_type].append(now)
        
        # Need N consecutive frames within last second
        if len(self.recent[violation_type]) < self.debounce_frames:
            return False
        if now - self.recent[violation_type][0] > 1.0:
            return False
        
        # Cooldown check
        last = self.last_alert.get(violation_type, 0)
        if now - last < self.cooldown_seconds:
            return False
        
        self.last_alert[violation_type] = now
        return True
```

This is the kind of code interviewers love asking about. Make sure you understand every line.

#### Step 4: Wire it together in `main.py`

```python
# detection/src/main.py (sketch)
import cv2
from ultralytics import YOLO
from detector import detect_violations
from debounce import ViolationTracker
from storage import upload_snapshot, log_violation

model = YOLO("models/ppe_v1.pt")
tracker = ViolationTracker(debounce_frames=5, cooldown_seconds=60)
camera_id = "00000000-0000-0000-0000-000000000001"  # hardcoded for MVP

cap = cv2.VideoCapture(0)
while True:
    ret, frame = cap.read()
    if not ret:
        continue
    
    results = model(frame, conf=0.6, verbose=False)
    violations_in_frame = detect_violations(results[0])
    
    for v_type in violations_in_frame:
        if tracker.should_alert(v_type):
            # Encode frame to JPEG bytes
            _, buffer = cv2.imencode(".jpg", frame)
            image_url = upload_snapshot(buffer.tobytes(), camera_id)
            log_violation(camera_id, v_type, confidence=0.8, image_url=image_url)
    
    annotated = results[0].plot()
    cv2.imshow("All Clear Detection", annotated)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
```

### Common gotchas

- **JPEG encoding fails on weird frame** â€” wrap in try/except, log, continue.
- **Supabase service-role key in client code** â€” NEVER use service role on the dashboard. Only in the Python detection service. The dashboard uses the anon key + Row Level Security.
- **S3 signed URL expiry** â€” for dashboard viewing, generate URLs with `boto3.client('s3').generate_presigned_url(...)` with `ExpiresIn=3600`.
- **Database connection pool exhaustion** â€” create one Supabase client per process, not per call.

### Deliverable

A 5-minute test session where you walk in/out of frame with/without a hat, then verify in Supabase Studio that:
- Violations are logged
- Image URLs work (open one in browser)
- Debouncing prevented duplicate spam (compare to "raw detection count")

### Interview-prep questions

1. "Why debounce 5 frames specifically?" (At ~30 FPS that's ~167ms â€” short enough to be responsive, long enough to filter single-frame noise from motion blur or partial occlusion.)
2. "Why 60-second cooldown?" (B2B reality: a foreman doesn't need 200 SMSes about the same worker. One alert per minute keeps the supervisor sane.)
3. "What happens if S3 is down?" (Currently: violation logged with null `image_url`. Better: queue for retry. Phase 5+ improvement.)

---

## Phase 3 â€” Alert Pipeline (Days 7-8, 5 hours)

**Goal:** when a violation is logged, send an SMS to the supervisor's phone within 5 seconds.

### Twilio onboarding (since you haven't used it)

#### What Twilio is
Twilio is an API for sending SMS, voice calls, and WhatsApp messages. You give them money, they give you a phone number, and your code calls their REST API to send messages from that number.

#### Setting up
1. Sign up at [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Verify your personal phone (this becomes the only number you can text on free trial)
3. Get a Canadian phone number from the Twilio console (free with trial)
4. Find your Account SID and Auth Token on the dashboard
5. Add to `.env`:

```
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_FROM_NUMBER=+1587XXXXXXX
TWILIO_TO_NUMBER=+1780XXXXXXX  # your verified personal phone
```

#### Send your first SMS

```python
# detection/src/alerts.py
from twilio.rest import Client
import os

client = Client(
    os.environ["TWILIO_ACCOUNT_SID"],
    os.environ["TWILIO_AUTH_TOKEN"]
)

def send_violation_sms(violation_type: str, camera_name: str, image_url: str):
    body = (
        f"[All Clear] {violation_type.replace('_', ' ').upper()} "
        f"at {camera_name} â€” view: {image_url[:50]}..."
    )
    message = client.messages.create(
        body=body,
        from_=os.environ["TWILIO_FROM_NUMBER"],
        to=os.environ["TWILIO_TO_NUMBER"]
    )
    return message.sid
```

Run it standalone first:
```python
if __name__ == "__main__":
    send_violation_sms("no_helmet", "Camera 1", "https://example.com")
```

You should get an SMS within 5 seconds.

#### Cost awareness
- Trial credit covers ~250 outgoing SMSes
- Production: $0.0075 USD per SMS to Canadian numbers
- A site with 50 violations/day = $0.40/day = $12/month per customer
- Your $500/month tier easily covers this

### Wire SMS into the violation logger

Modify `storage.log_violation` to call the alert after a successful insert. Or â€” better, more decoupled â€” use Supabase Database Webhooks: configure Supabase to POST to a small webhook endpoint when a row is inserted into `violations`. The webhook calls Twilio.

For MVP, inline call from Python is fine. Webhook decoupling is a Phase 5 improvement.

### Email digests (AWS SES)

A daily/weekly summary to the supervisor's email is a different use case than SMS â€” it's not urgent, it's reporting.

```python
# detection/src/alerts.py (add)
import boto3

ses = boto3.client("ses", region_name=os.environ["AWS_REGION"])

def send_daily_digest(to_email: str, html_body: str):
    ses.send_email(
        Source="alerts@allclear.app",  # must be verified in SES
        Destination={"ToAddresses": [to_email]},
        Message={
            "Subject": {"Data": "[All Clear] Daily Compliance Summary"},
            "Body": {"Html": {"Data": html_body}}
        }
    )
```

**SES setup gotcha:** SES starts in "sandbox mode" â€” you can only send to verified email addresses. For demo, verify your own email and Allan's. For pilot customer, request production access (24-48 hour AWS review).

### Common gotchas

- **Trial Twilio numbers prepend "Sent from a Twilio trial account" to every SMS.** Looks unprofessional in demo. Upgrade to paid before showing customers.
- **SMS messages over 160 chars get split into segments** ($$). Keep alerts terse.
- **Don't include full image URLs in SMS** â€” they're long and ugly. Use a URL shortener (Bitly free tier) or a `allclear.app/v/<id>` route.
- **Rate limits:** Twilio caps at 1 SMS/second on trial. Real production: 100/sec. For MVP, fine.

### Deliverable

End-to-end demo: walk in front of webcam without a hard hat â†’ SMS arrives on your phone within 5 seconds with a link.

### Interview-prep questions

1. "Why SMS instead of just email?" (Construction supervisors don't check email during the workday. SMS gets read. Email is for end-of-day summaries.)
2. "What happens if Twilio is down?" (Currently fail silently with a log. Production needs queue + retry. Acknowledge as a known gap.)
3. "Why isn't this on a queue like SQS?" (Premature complexity. Direct call works at <100 violations/min. Add SQS when scale demands it.)

---

## Phase 4 â€” Supervisor Dashboard (Days 9-12, 12 hours)

**Goal:** a Next.js + Amplify dashboard where a supervisor logs in and sees live violations with photos, can mark them resolved, and sees charts.

This is where the most "looks like a real product" perception comes from. Spend the time.

### Architecture

```
Next.js 15 (App Router)
â”œâ”€â”€ Server components for static / fetch
â”œâ”€â”€ Client components for Realtime subscriptions
â”œâ”€â”€ shadcn/ui for everything visual
â”œâ”€â”€ Supabase JS client (anon key only â€” no service role)
â”œâ”€â”€ Tailwind for styling
â””â”€â”€ Recharts for the chart pages
```

Auth: Supabase Auth with email magic links (no passwords for MVP â€” easier and more secure).

### Pages

| Route                        | Purpose                                 |
| ---------------------------- | --------------------------------------- |
| `/`                          | Marketing landing page (Phase 5)        |
| `/login`                     | Magic link auth                         |
| `/dashboard`                 | Live violations feed + recent stats     |
| `/dashboard/violations/[id]` | Single violation detail with full photo |
| `/dashboard/cameras`         | Manage registered cameras               |
| `/dashboard/settings`        | Alert recipient phone, working hours    |

### Step-by-step

#### Step 1: Bootstrap Next.js

```powershell
cd dashboard
npx create-next-app@latest . --typescript --tailwind --app
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card table dialog input form
```

#### Step 2: Supabase client setup

```typescript
// dashboard/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // anon key, never service role
);
```

#### Step 3: Realtime violations feed

This is the big one â€” you've done it on GridSync, you know the pattern:

```typescript
// dashboard/components/ViolationFeed.tsx
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function ViolationFeed() {
  const [violations, setViolations] = useState([]);
  
  useEffect(() => {
    // Initial fetch
    supabase
      .from("violations")
      .select("*, cameras(name, sites(name))")
      .order("detected_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setViolations(data || []));
    
    // Realtime subscription
    const channel = supabase
      .channel("violations")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "violations" },
        (payload) => {
          setViolations((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, []);
  
  return (
    <div className="space-y-2">
      {violations.map((v) => (
        <ViolationCard key={v.id} violation={v} />
      ))}
    </div>
  );
}
```

#### Step 4: Resolution workflow

A violation has three states: `pending`, `resolved`, `false_positive`. Supervisor clicks a button, status updates, dashboard reflects in real time.

```typescript
async function markResolved(violationId: string, status: string) {
  await supabase
    .from("violations")
    .update({
      resolution_status: status,
      resolved_at: new Date().toISOString()
    })
    .eq("id", violationId);
}
```

#### Step 5: Charts page

Use Recharts â€” same library you used on GridSync. Two charts for MVP:

1. Violations by hour (line chart, last 24h)
2. Violations by type (bar chart, last 7 days)

Don't over-design. Two clean charts beat six cluttered ones.

#### Step 6: Deploy to Amplify

You've done this on PatrolPrep:
1. Push to GitHub (still private)
2. Amplify Console â†’ "Deploy from GitHub" â†’ select repo â†’ select `dashboard/` as root
3. Add environment variables in Amplify settings (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
4. Auto-deploys on push to main

### Common gotchas

- **Row Level Security (RLS)** â€” Supabase tables are public by default until you turn on RLS. Turn it on for production. For MVP with one customer, you can leave it off but document that you know.
- **Image URLs from S3 require signed URLs** â€” implement a small server route that generates a pre-signed URL for each image. Don't make S3 bucket public.
- **Hydration errors with Realtime** â€” Supabase subscription only runs client-side. Use `"use client"` directive.
- **Amplify auto-deploy fails** â€” usually env vars not set. Check build logs.

### Deliverable

A live URL (e.g., `dashboard.allclear.app`) where you can:
1. Log in
2. See live violations as they happen (run detection script, watch dashboard update)
3. Click a violation â†’ see photo
4. Mark it resolved â†’ status updates everywhere

### Interview-prep questions

1. "Walk me through how a violation gets from detection to dashboard." (Python detector inserts into Postgres â†’ Supabase Realtime broadcasts via Postgres logical replication â†’ Next.js client subscription receives the row â†’ React state updates â†’ component re-renders.)
2. "Why anon key on the frontend, not service role?" (Service role bypasses RLS. If we put it in client code, anyone could read or write any row. Anon key respects RLS rules.)
3. "Why Amplify over Vercel?" (Stays in AWS ecosystem matching the rest of our stack â€” S3, SES, future Lambda. Easier IAM integration. Same tier of pricing/perf for our scale.)

---

## Phase 5 â€” Polish for Demo Day (Days 13-14, 6 hours)

**Goal:** make it look like a real product, not a student project.

### Tasks

1. **Custom domain** â€” buy `allclear.app` or `allclear.ca` (~$12-30/year). Point to Amplify.
2. **Landing page** at `/` â€” hero, problem statement, 60-second demo video, "Request a pilot" form (links to a Calendly or just an email).
3. **Demo mode** â€” a button on the dashboard that loads pre-seeded fake violations from a test site, so you can demo without your laptop's webcam running. Critical for showing Allan and potential customers.
4. **Brand polish** â€” pick a color palette (one primary, one accent), make a simple logo (Figma free + a "construction safety" icon), apply consistently.
5. **Demo run-throughs** â€” practice the 3-minute pitch 5 times. Time it. Cut anything that doesn't directly support the story.

### The pitch structure

1. **0:00-0:30** â€” The problem (TRIR, COR audits, manual paperwork)
2. **0:30-1:30** â€” Live demo (webcam â†’ SMS arrives â†’ dashboard updates)
3. **1:30-2:30** â€” The wedge (Alberta-specific, integration with SALUS, mid-market pricing)
4. **2:30-3:00** â€” Traction so far + ask (customer conversations, what we need)

### Deliverable

A working URL you can confidently put on a slide and send to anyone.

---

## The ML Co-Ownership Model

You said you want to co-own ML, not hand it off. Here's how that works practically.

### What "ML ownership" actually means

ML in a product like All Clear has four layers, and you can own different ones:

| Layer                  | What it is                                        | MVP owner      | Long-term owner            |
| ---------------------- | ------------------------------------------------- | -------------- | -------------------------- |
| Model selection        | Picking YOLO11 vs YOLO26, n vs s vs m vs l        | Manraj         | Xavion (with Manraj input) |
| Training & fine-tuning | Running the training loop on PPE datasets         | Both initially | Xavion primary             |
| Inference deployment   | Loading model, running it on frames in production | Manraj         | Manraj                     |
| Model evaluation       | Measuring accuracy, debugging false positives     | Both           | Both                       |

You own inference deployment forever â€” that's backend/infra, your strength. You co-own evaluation forever â€” both founders need to debug the product. Training shifts toward Xavion as he ramps up post-May 26.

### How to actually co-own (not just say so)

#### 1. Run training yourself once
Using the dataset from Roboflow + your RTX 4080, train your own YOLO model from scratch for 50 epochs. ~2 hours wall-clock. You'll learn:
- What the training loop looks like
- What `epochs`, `batch_size`, `lr` (learning rate) actually do
- How loss curves work (training loss should drop, validation loss should follow but may diverge â€” that's overfitting)
- How to read the resulting `results.png` showing precision/recall/mAP

```bash
yolo detect train data=construction_ppe.yaml model=yolo11s.pt epochs=50 imgsz=640 batch=16 device=0
```

After this you can credibly say "I trained the All Clear model" without asterisks.

#### 2. Read one technical YOLO paper
Pick *one* of the YOLO papers â€” YOLOv8 doesn't have a formal paper but YOLOv9 ([arxiv.org/abs/2402.13616](https://arxiv.org/abs/2402.13616)) does. Read the abstract, the architecture diagram, and the conclusion. Skip the math. Goal: understand the high-level innovation, not derive it.

#### 3. Maintain shared model evaluation notes
In `NOTES.md`, keep a running log of model behavior:
- "False positive: model flags baseball caps as helmets ~30% of the time. Fix: more diverse training data including caps."
- "False negative: model misses helmets in low light. Fix: data augmentation with brightness variation."

This becomes your shared language with Xavion. When he takes over training, this log tells him what to fix.

#### 4. Own one specific model improvement experiment per month
Pick something narrow. Examples:
- "Try fine-tuning on 200 Alberta winter images"
- "Compare YOLO11n vs YOLO11s latency on the production server"
- "Test data augmentation strategies"

You don't need to do all of them. Pick one per month. Document the result. This keeps your ML hands warm without it becoming your full-time focus.

### Resources

- **Ultralytics training docs** â€” [docs.ultralytics.com/modes/train/](https://docs.ultralytics.com/modes/train/)
- **A good "fine-tuning YOLO" walkthrough** â€” [Roboflow's blog](https://blog.roboflow.com/how-to-train-yolov8-on-a-custom-dataset/)
- **The mAP metric explained simply** â€” [Jonathan Hui's article](https://jonathan-hui.medium.com/map-mean-average-precision-for-object-detection-45c121a31173)

---

## Edge Cases & Known Issues

These will break in production. We accept them for MVP. Document them so future-you / Xavion knows.

### Detection accuracy

| Issue                                                             | Severity | When to fix                            |
| ----------------------------------------------------------------- | -------- | -------------------------------------- |
| Generic PPE model fails on Alberta winter (toques under hardhats) | High     | Phase 4+ with pilot footage            |
| Confidence threshold 0.6 is arbitrary                             | Medium   | Tune with real customer feedback       |
| Model doesn't distinguish workers from visitors                   | Medium   | Phase 5+ with worker re-identification |
| No tracking â€” same person counted as multiple violations          | Medium   | Phase 5+ with DeepSORT                 |

### Infrastructure

| Issue                                             | Severity                             | When to fix                               |
| ------------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| Single point of failure: laptop running detection | High                                 | Pilot site = edge device (Jetson Nano)    |
| No retry logic if S3/Twilio down                  | Medium                               | Add queue + retry in Phase 5              |
| No multi-tenant isolation                         | High                                 | Required before customer #2               |
| RLS not configured                                | High                                 | Required before any production deployment |
| Service role key in Python service env            | Low (acceptable for trusted backend) | N/A                                       |

### Privacy

| Issue                      | Severity     | When to fix                                                       |
| -------------------------- | ------------ | ----------------------------------------------------------------- |
| No worker consent flow     | **Critical** | Required before any pilot deployment in Alberta â€” see Â§13         |
| Photos stored indefinitely | High         | Add retention policy (30 days for resolved, 1 year for incidents) |
| No data residency control  | Medium       | Verify S3 bucket region is `ca-central-1`                         |

### Operational

| Issue                                   | Severity | When to fix                            |
| --------------------------------------- | -------- | -------------------------------------- |
| One alert recipient hardcoded           | Low      | Add multi-recipient routing in Phase 5 |
| No alert escalation if not acknowledged | Low      | Phase 6+                               |
| No working-hours config (alerts at 3am) | Medium   | Add to settings page                   |

---

## Legal: AGPL & Privacy

### The AGPL-3.0 issue

**The problem:** Ultralytics YOLO is licensed under AGPL-3.0. AGPL is "copyleft" â€” if you build a SaaS using it and don't open-source your *entire codebase*, you're technically in violation.

**For MVP (no paying customers yet):** Fine. You're a student project. Internal use is permissible.

**Before customer #1:** Must resolve. Three paths:

1. **Buy the Ultralytics Enterprise License** â€” pricing is custom; for a pre-revenue student team they sometimes give discounts or free licenses. Email `licensing@ultralytics.com` with your situation.
2. **Switch to a non-AGPL YOLO implementation** â€” original Darknet YOLO, or Apache-2.0 forks like [WongKinYiu/yolov7](https://github.com/WongKinYiu/yolov7) or some YOLOX variants. Adds ~20 hours of integration work.
3. **Open-source the entire All Clear codebase under AGPL** â€” only viable if you go open-core (free codebase, paid hosting/support). Probably not your business model.

**Most likely path:** Email Ultralytics in Phase 4-5, ask for a startup license. Many YC-backed companies have done this. You're not the first.

Add to `QUESTIONS.md` and to the Edmonton Unlimited "what we need" list (legal advisor referral).

### Privacy: PIPA (Alberta) + PIPEDA (federal)

**The problem:** filming workers and storing footage = collection of personal information. Alberta's *Personal Information Protection Act* (PIPA) and Canada's *Personal Information Protection and Electronic Documents Act* (PIPEDA) both apply.

**What this means concretely:**

1. **Workers must be notified.** Visible signs at site entrances: "Video monitoring in use for workplace safety. Footage retained 30 days. Contact: [email]."
2. **Consent should be obtained.** New hire orientation includes acknowledgment. Existing workforce: written notice with reasonable notice period.
3. **Purpose limitation.** Footage can only be used for safety compliance, not productivity surveillance, not discipline-shopping.
4. **Retention limits.** 30 days for general footage. 1 year for incident-related footage. Document the policy.
5. **Data residency.** Keep footage in Canadian region (S3 `ca-central-1`).
6. **Edge processing where possible.** When inference happens on-site (Jetson Nano), raw footage never leaves the customer's network. Massive privacy advantage over cloud-streaming competitors.

**Action items:**
- One-hour consult with an Alberta tech privacy lawyer before pilot deployment ($300-500)
- Draft a worker notice template (lawyer reviews)
- Add data retention to the violation table:
  ```sql
  alter table violations add column auto_delete_after timestamptz 
    default (now() + interval '30 days');
  ```
- Add a daily cleanup job that deletes expired rows + S3 objects

Add this to your Edmonton Unlimited "what we need" list â€” they have lawyers in their advisor pool.

---

## What's Deliberately NOT in MVP

So you can defend scope when someone asks "why doesn't it do X."

- **Multi-tenant architecture** â€” single customer in MVP. Multi-tenancy added before customer #2.
- **Worker identification / tracking** â€” knowing it's the same person across frames. Requires DeepSORT or similar. Phase 5+.
- **PDF compliance reports for COR audits** â€” promised in business plan, but not in 14-day build. Phase 5+ priority.
- **SALUS API integration** â€” promised in business plan as Phase 2 feature. Not in MVP. Will build after first customer conversation reveals what they actually want.
- **Mobile app** â€” dashboard is responsive web. Native app is post-PMF.
- **Multi-camera dashboard view** â€” single camera per site for MVP. Multi-camera before customer with multi-site.
- **Custom violation types** â€” only `no_helmet`, `no_vest` for MVP. Custom rules engine is Phase 6+.
- **Edge deployment** â€” laptop running detection in MVP. Jetson Nano deployment for pilot.
- **Video review (vs photo)** â€” only snapshots stored. Full video archive is bandwidth-heavy and privacy-risky. Defer.

---

## Resources Index

### Tech docs
- [Ultralytics YOLO Quickstart](https://docs.ultralytics.com/quickstart/)
- [Ultralytics Training Mode](https://docs.ultralytics.com/modes/train/)
- [OpenCV Python Tutorials](https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Supabase Docs](https://supabase.com/docs)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Twilio Python Quickstart](https://www.twilio.com/docs/sms/quickstart/python)
- [AWS S3 boto3 Reference](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3.html)
- [AWS SES Setup](https://docs.aws.amazon.com/ses/latest/dg/setting-up.html)
- [Next.js 15 App Router](https://nextjs.org/docs/app)
- [shadcn/ui Components](https://ui.shadcn.com/docs)
- [AWS Amplify Hosting](https://docs.amplify.aws/nextjs/start/quickstart/nextjs-app-router-client-components/)

### Datasets & models
- [Roboflow Construction Site Safety](https://universe.roboflow.com/roboflow-universe-projects/construction-site-safety)
- [Roboflow Universe PPE search](https://universe.roboflow.com/search?q=construction+ppe)
- [VoxDroid PPE Detection (reference repo)](https://github.com/VoxDroid/Construction-Site-Safety-PPE-Detection)
- [snehilsanyal PPE Detection (reference repo)](https://github.com/snehilsanyal/Construction-Site-Safety-PPE-Detection)

### Concept reading
- [Roboflow's Guide to YOLO Models](https://blog.roboflow.com/guide-to-yolo-models/)
- [Jonathan Hui on mAP](https://jonathan-hui.medium.com/map-mean-average-precision-for-object-detection-45c121a31173)
- [Real Python: Async/Await](https://realpython.com/async-io-python/)
- [Real Python: f-strings](https://realpython.com/python-f-strings/)

### Legal / regulatory
- [Alberta PIPA overview](https://www.alberta.ca/personal-information-protection-act)
- [PIPEDA fair information principles](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/)
- [WCB Alberta PIR Program](https://www.wcb.ab.ca/insurance-and-premiums/lower-your-premiums/partnerships-in-injury-reduction-(pir).html)

### Business context
- See `allclear_Strategy_and_BusinessPlan_v2.docx` (separate document)
- Edmonton Unlimited Student Founders: Grow program calendar (May 5 â€“ Aug 19, 2026)

---

## Final notes

**Update this document as you learn.** Every gotcha, every "why did I do this," every interview prep insight â€” it goes back here. By Demo Day, this file should be longer than it is now.

**Keep `NOTES.md` and `QUESTIONS.md` separate from this.** This is the *plan*. NOTES is the *log*. QUESTIONS is the *backlog*.

**When in doubt, simpler.** Every component you add must justify itself in interview-defense terms: "I added X because Y. Without it, Z would have happened." If you can't say that, don't add it.

Build it well. Build it on time. Build it so you understand every line.