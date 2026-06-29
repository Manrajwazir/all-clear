<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:0b3d2e,50:10b981,100:0b3d2e&height=160&section=header&text=All%20Clear&fontSize=58&fontColor=ffffff&animation=fadeIn&fontAlignY=40" alt="All Clear"/>
</p>

<p align="center">
  <b>Computer vision that turns a worksite's existing cameras into automated safety compliance.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active%20development-10B981?style=flat-square" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/PyTorch%20%2F%20YOLO-EE4C2C?style=flat-square&logo=pytorch&logoColor=white" />
  <img src="https://img.shields.io/badge/AWS-232F3E?style=flat-square&logo=amazonwebservices&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" />
</p>

---

## What it does

All Clear connects to a facility's **existing IP cameras** and runs computer-vision detection at the edge to flag personal protective equipment (PPE) violations — a missing hard hat, a missing hi-vis vest — in real time. Each confirmed violation is logged with a timestamp and location, a supervisor is alerted, and the events build into a continuous, auditable safety record.

The product isn't the detection on its own — it's the **automated, defensible compliance audit trail** that detection produces.

## How it works

```
Existing IP cameras  →  Edge device (on-site GPU)  →  Cloud  →  Real-time alerts + dashboard
                         · runs detection locally       · stores events
                         · filters noise                · serves dashboard
                         · sends only violation events  · triggers alerts
```

- **Edge-first.** Detection runs on-site. Only structured violation events leave the facility — not raw video. This keeps the system fast, bandwidth-light, resilient to connectivity drops, and privacy-respecting by design.
- **Noise filtering.** Detections are debounced across frames and rate-limited per event type, so a single violation produces one meaningful alert — not a flood.
- **Privacy by design.** No continuous footage leaves the site, no facial recognition. The system is built to output *what happened, where, and when* — not to surveil individuals.

## Tech stack

| Layer            | Tools                                              |
| ---------------- | -------------------------------------------------- |
| Detection        | Python, PyTorch, YOLO (Ultralytics)                |
| Edge             | On-site GPU inference                              |
| Cloud / backend  | AWS (Canadian region), serverless event processing |
| Data + dashboard | Next.js, real-time data layer                      |
| Alerts           | SMS / messaging integration                        |

## Status

All Clear is an **incorporated Alberta company** currently in active research commercialization, advancing the system from a working prototype toward validated, real-world deployment through an applied-research program.

> This repository contains the application code. It is under active development and evolving quickly.

## About

Built by [Manraj Singh Wazir](https://www.linkedin.com/in/manraj-wazir/) and team.
For more about the company: [All Clear](REPLACE_WITH_ALL_CLEAR_LINK)