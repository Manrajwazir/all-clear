# All Clear

PPE detection that turns each detection into a tamper-evident compliance record.

The detection model is off the shelf. The part this project is about is what
happens after the frame: every event is sealed server-side into a per-device
hash chain, and an edit to a sealed field is refused by the database.

## Where it stands today

- **Detection runs on a laptop GPU, reading a webcam.** Camera index 0 is
  hardcoded in `detection/src/main.py`. IP cameras (RTSP) are not wired up yet.
- **There is no edge build yet.** A port to NVIDIA Jetson is planned under an
  applied research program. The current code needs a display (`cv2.imshow`), loads
  a PyTorch `.pt` model rather than a TensorRT engine, and has no service or
  shutdown-signal handling.
- **The record layer is split across two repos.** The device API that receives
  and authenticates events is here, in `dashboard/app/api/v1/`. The database side
  (the hash chain, the immutability trigger, the row-level security policies)
  lives in a private repository and is not published.
- **No imagery is stored by default.** Snapshots are an opt-in, per-site mode.

## Run detection locally

You need Python 3.11+ and a webcam. An NVIDIA GPU is optional but makes a large
difference; without one, detection runs on CPU, slowly.

**If you have an NVIDIA GPU, install a CUDA build of PyTorch first**, using the
command pytorch.org gives for your CUDA version. The line below otherwise installs
the CPU-only build, and detection quietly runs on CPU even with a GPU present.

```bash
cd detection
pip install -e ".[dev]"
```

**Model weights are not in this repo.** Detection uses Ultralytics YOLOv8 with
weights from `VoxDroid/Construction-Site-Safety-PPE-Detection`. Save the weights
file as `detection/models/ppe_v1.pt`.

```bash
python src/main.py
```

With no `DEVICE_API_KEY` set it runs in local mode: detections are logged to the
terminal and nothing leaves the machine. Press `q` in the video window to quit.

Check the first log line: it should say `Model loaded on CUDA:0`. If it says
`CPU`, PyTorch can't see your GPU.

If the camera won't open, close any other app using it. Video-call apps are the
usual culprit, and no amount of retrying gets the camera back from them.

Tests: `pytest` from `detection/`.

## Stack

| Part | Tools |
|---|---|
| Detection | Python, OpenCV, Ultralytics YOLOv8 |
| Device API and dashboard | Next.js route handlers, TypeScript |
| Database | Supabase Postgres, Canadian region |
| Snapshot storage (opt-in only) | AWS S3 |
| Alerts | Twilio SMS |

## About

Built by [Manraj Singh Wazir](https://www.linkedin.com/in/manraj-wazir/) and
[Xavion Dean](https://www.linkedin.com/in/xavion-dean/).
More about the company: [All Clear](https://www.linkedin.com/company/all-clear-inc).
