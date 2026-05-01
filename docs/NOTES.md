# SiteIQ — Learning Log (NOTES.md)

Running log of things learned, gotchas hit, and concepts understood.
Update this as you build. By Demo Day this should be long.

---

## ML / YOLO Concepts

### What YOLO is actually doing
YOLO ("You Only Look Once") splits the image into a grid and for each cell predicts:
- Whether an object is centered there (objectness score)
- Bounding box coordinates relative to the cell
- Class probabilities (helmet? vest? person?)

All in one forward pass. That's why it's fast enough for video.

**Interview answer:** "YOLO does object detection in a single forward pass by predicting
bounding boxes and class probabilities directly from grid cells, rather than using a
region-proposal network like R-CNN. That's why it runs in real time."

### What a pre-trained model is
A model is a pile of numerical weights inside a neural network. Training from scratch
on object detection takes weeks of GPU time on millions of images.

Our model (ppe_v1.pt) = YOLOv8s weights pre-trained on COCO (80 common objects),
then fine-tuned by VoxDroid on 2,801 construction PPE images for 200 epochs.
We use it directly. Fine-tuning on Alberta footage is post-MVP.

### What mAP means
mAP@50 = mean Average Precision at IoU threshold 0.5. A box is "correct" if it
overlaps the ground truth by 50%+. Our model: 84.1% mAP@50.
Above 80% is good for real customers. Below 70% = too many false positives.

### The 10 classes our model knows
0: Hardhat | 1: Mask | 2: NO-Hardhat | 3: NO-Mask | 4: NO-Safety Vest
5: Person | 6: Safety Cone | 7: Safety Vest | 8: machinery | 9: vehicle

We only alert on: NO-Hardhat, NO-Safety Vest, NO-Mask (the "violation classes").

---

## Architecture Concepts Learned

### Why debounce + cooldown are different things
- **Debounce (5 frames)** = frame-level noise filter. Prevents a single blurry frame
  from triggering an alert. At 30 FPS, 5 frames ≈ 167ms.
- **Cooldown (60s)** = event-level deduplication. After firing, mutes that violation
  type for 60 seconds. Prevents SMS spam.
- They solve different problems. You need both.

### Why service role key only in Python backend
- Service role bypasses Row Level Security (RLS) — can read/write any row
- If exposed in browser code, anyone who opens devtools has full DB access
- Python backend is trusted (runs on your machine / edge device)
- Dashboard uses anon key only — it respects RLS rules

### Why S3 over storing images in Supabase Storage
- S3 is cheaper at scale
- ca-central-1 bucket = PIPA compliance (data stays in Canada)
- Industry standard — every interviewer will recognize it
- Pre-signed URLs let you share private images securely with expiry

### Why Supabase over pure AWS RDS
- Supabase Realtime (Postgres logical replication → WebSocket) = live dashboard
  updates without polling. Building this on API Gateway + Lambda = 20+ extra hours.
- Already proven on GridSync. Known patterns.

---

## Build Gotchas (Things That Actually Went Wrong)

### Python environment mess (April 30, 2026)
- Had MSYS2 Python (3.12.9) first in PATH — no pip, wrong interpreter
- Had broken Python 3.13 reference (`.ese` typo in PATH instead of `.exe`)
- Fix: installed Python 3.11 from python.org, added `Python311\` AND `Python311\Scripts\`
  to PATH (the directory, not the exe)
- Lesson: always check `where.exe python` to see what actually runs

### pyproject.toml + hatchling build error
- Error: `Unable to determine which files to ship inside the wheel`
- Cause: hatchling expects a folder named after the project (`ppe_detection`),
  but our code is in `src/`
- Fix: add `[tool.hatch.build.targets.wheel] packages = ["src"]`

### PyTorch installing as CPU-only
- First `pip install torch` gets the CPU wheel by default
- Fix: `pip uninstall torch torchvision -y` then reinstall with CUDA wheel:
  `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126`
- RTX 4080 Laptop GPU: CUDA driver 13.1, use cu126 wheel

### OpenCV `q` key not closing the window
- Pressing `q` in the terminal doesn't work — OpenCV only reads keypresses
  when its own window has focus
- Fix: click the camera window first, THEN press q (or ESC)
- Also increased `cv2.waitKey(1)` → `cv2.waitKey(30)` to give the event loop time

### Supabase RLS warning on schema run
- Supabase warns "tables will not have RLS enabled" when running schema.sql
- For MVP: click "Run without RLS" — acceptable because the Python backend
  uses service role key which bypasses RLS anyway, and the dashboard isn't live yet
- Required fix before production: add RLS policies to violations table

---

## Live Testing Observations (May 1, 2026)

### Phase 2 test — 10 seconds in front of webcam
- Raw detections: ~300 frames × 3 violations = ~900 DETECTED log lines
- Actual violations logged in Supabase: 3 (one per type)
- Actual S3 images: 3 (one per type)
- Conclusion: debounce + cooldown working exactly as designed

### Phase 3 test — SMS alerts
- Time from standing in frame to SMS received: ~5-8 seconds
  (debounce adds ~167ms, Supabase insert + S3 upload adds ~2-3s, Twilio ~1-2s)
- Trial Twilio number: +1 814 791 6276 (Curwensville, PA)
- Sends FROM the Twilio number TO your verified personal number
- "Sent from a Twilio trial account" prepended to every SMS — upgrade before demos

### Model accuracy on developer (Manraj)
- Detected NO-Hardhat: consistently ~0.85-0.89 confidence ✓
- Detected NO-Safety Vest: consistently ~0.92-0.95 confidence ✓
- Detected NO-Mask: consistently ~0.87-0.91 confidence ✓
- False positive rate: low in controlled indoor test
- Not yet tested: outdoor lighting, winter clothing, hard hats present

---

## Interview Prep Answers

**"Walk me through how a frame becomes a detection."**
Webcam → OpenCV NumPy array → YOLO single forward pass → bounding boxes with
class + confidence → filter for violation classes → debounce check → S3 + Supabase → SMS.

**"Walk me through how a violation appears on the dashboard."**
Python backend inserts a row → Supabase Realtime detects the INSERT via logical replication →
pushes payload over WebSocket → React `useEffect` subscription catches it → re-fetches the
row with camera join → prepends to violations array → `deriveStatus()` recalculates hero word →
AnimatePresence animates the new ViolationCard in → image loaded via pre-signed S3 URL from
`/api/signed-url` route.

**"Why confidence threshold 0.6 specifically?"**
Tradeoff: lower = more detections including false positives; higher = misses real violations.
0.6 is our starting point — we'll tune with real customer feedback.

**"What's running on the GPU vs CPU?"**
YOLO inference runs on CUDA cores (RTX 4080). OpenCV frame capture and image
encoding run on CPU. Supabase/S3/Twilio calls are async network I/O.

**"Why debounce 5 frames specifically?"**
At ~30 FPS that's ~167ms. Short enough to be responsive, long enough to filter
single-frame noise from motion blur or partial occlusion.

**"Why 60-second cooldown?"**
A foreman doesn't need 200 SMSes about the same worker. One alert per minute
keeps the supervisor sane and the signal-to-noise ratio high.

**"What happens if S3 is down?"**
Currently: violation logged in Supabase with null image_url. Error caught and logged,
detection loop continues. Production needs a retry queue. Acknowledged known gap.

**"Why pre-signed URLs instead of making the S3 bucket public?"**
PIPA compliance (Alberta privacy law). Images show workers' faces. Private bucket + expiring
URLs = data minimization. Each URL expires in 1 hour. If a URL leaks, it goes dead.

**"What's the difference between Active, Pending, and Resolved?"**
Active = pending + less than 5 minutes old (amber, needs attention NOW).
Pending = pending + older than 5 minutes (blue, still needs triage).
Resolved = supervisor clicked "Mark resolved" (teal, done).
False positive = supervisor flagged as model error (gray, helps future retraining).

---

## Phase 4 — Dashboard Build Notes (May 1, 2026)

### Architecture choices
- **Next.js 15 App Router** with server components by default, client components only for
  interactive pieces (ViolationFeed, DetailPanel, StatusHero's breathing animation).
- **Tailwind v4** — CSS-first config in `globals.css`, no `tailwind.config.js`. Design tokens
  are CSS custom properties (`--surface-base`, `--status-warning`, etc.).
- **Geist + Geist Mono** fonts via `next/font/google` — avoids generic Inter/Roboto look.
- **No Zustand/Redux** — React state is sufficient for MVP. ViolationFeed holds violations[]
  in useState, derived status is useMemo.

### Supabase Realtime subscription pattern
```typescript
supabase.channel("violations-feed")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "violations" }, callback)
  .subscribe();
```
On INSERT, we get the raw payload but it doesn't include the camera join. So we do a
second `fetchOne(id)` query to get the enriched `ViolationWithCamera` before rendering.

### Pre-signed URL architecture
S3 images are private → browser can't load them directly → added `/api/signed-url` route
that generates 1-hour pre-signed URLs via `@aws-sdk/s3-request-presigner`. Created
`useSignedUrl()` hook that ViolationCard and DetailPanel use to convert raw S3 URLs.

### Harmless terminal 404s
- `LayoutGroupContext.mjs.map 404` — Next.js dev-mode source map, no production impact
- `com.chrome.devtools.json 404` — Chrome extension config probe, no impact

### StatusPill logic (status.ts)
- Active window: 5 minutes (`ACTIVE_WINDOW_MS = 5 * 60 * 1000`)
- Safe window: 60 seconds (`SAFE_WINDOW_MS = 60 * 1000`)
- Critical threshold: 3+ active violations
- Warning threshold: 1+ active violations
- Re-renders every 30 seconds so pills age out naturally
