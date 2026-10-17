# All Clear

PPE detection that turns each detection into a tamper-evident compliance record.

The detection model is off the shelf. The part this project is about is what
happens after the frame: every event is sealed server-side into a per-device
hash chain, and an edit to a sealed field is refused by the database.

## Where it stands today

- **Detection reads a webcam, an IP camera (RTSP) or a video file**, chosen by
  `CAMERA_SOURCE`. One thread owns the camera and hands the loop the newest frame,
  never the same one twice, so a slow model can't fall behind the camera. A
  stream that drops or hangs is noticed within seconds and reconnects on its own.
- **It can run with no screen**, for a device in a trailer. It stops cleanly on
  Ctrl+C or a service manager's stop signal. Its exit code says why it stopped,
  and its heartbeat says whether it is actually watching.
- **There is no edge build yet.** A port to NVIDIA Jetson is under way as part
  of an applied research program. The code still loads a PyTorch `.pt` model
  rather than a TensorRT engine, and there is no service file yet.
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

### An IP camera, with no window

Settings live in `detection/.env`. `detection/.env.example` lists every one, with
what it does. For a camera on the network:

```
CAMERA_SOURCE=rtsp://192.168.1.64:554/Streaming/Channels/101
CAMERA_USERNAME=viewer
CAMERA_PASSWORD=as the camera has it
HEADLESS=true
```

Keep the login out of the address. An address with `user:pass@` in it is refused,
because the address is printed in the log. On Linux with no screen, `HEADLESS`
can be left blank.

With no window, the log carries one `STATUS` line a minute:

```
STATUS camera=online received=1800 processed=1650 skipped=150 fps=27.5 alerts=0 blind_s=0 queue_pending=0
STATUS camera=degraded reason=unreachable received=0 processed=0 skipped=0 fps=0.0 alerts=0 blind_s=95 queue_pending=0
```

The counts are for that minute only. `queue_pending` appears when a device key
is set: it counts violations waiting for the internet.

Stop it with Ctrl+C. It finishes the frame in hand and exits with a code a
service manager can act on:

| Exit code | Meaning | Restart? |
|---|---|---|
| 0 | stopped when asked, or a video file finished | no |
| 1 | crashed, a background thread died, or the model failed 10 frames in a row | yes |
| 3 | the server rejected the device key | no: fix the key |
| 4 | a setting can't work (camera, video file, `HEADLESS`, model file) | no: fix the setting |

### Tests

`pytest` from `detection/`. It never touches a real database or sends an SMS:
the live tests refuse to run against production.

To test against a camera that misbehaves on demand, use the simulated one in
`detection/simcam/`. It is an RTSP server in Docker that can drop, hang or
refuse on command:

```bash
python simcam/fault.py up
SIMCAM=1 pytest tests/simcam      # about 6 minutes
python simcam/fault.py down
```

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
