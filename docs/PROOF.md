# SiteIQ — Industry & Technology Validation Log (PROOF.md)

Evidence that the market exists, the technology works, and we have standing to build this.
Update before every investor/mentor conversation.

**Last updated:** May 1, 2026

---

## 1. Market Validation — Competitors Prove the Model Works

### CompScience — $37.6M raised (Series A + B)
- Backed by Nationwide Insurance and Swiss Re (A-rated reinsurers)
- Business model: bundle AI safety platform free with workers' comp insurance policy
- **What this proves:** AI computer vision for construction safety is fundable and scalable
- **Our differentiation:** Pure SaaS, no insurance license required, Canadian mid-market
  pricing ($500-900/month vs enterprise-only insurance play)
- Source: CompScience.com, Benzinga funding coverage

### Voxel — $83M raised
- Pure-play AI safety platform, enterprise-focused
- **What this proves:** standalone AI safety SaaS (not bundled with insurance) is viable
- **Their gap:** $3K-$10K+/month pricing, no Alberta mid-market focus
- Source: Crunchbase, Voxel.ai

### SALUS — 140,000 workers on platform (Canadian)
- Canadian construction safety SaaS — digital forms, hazard observations, no AI vision
- **What this proves:** Canadian GCs already pay for and use digital safety software
- **Our opportunity:** SALUS is the paperwork layer. We are the vision layer they don't have.
  Potential future integration partner.
- Source: SALUS official site

### HammerTech Intelligence — AI features launching 2026
- 20,000+ sites globally, just launched AI-powered safety features
- **What this proves:** the industry is actively moving toward AI safety in 2026, not resisting it
- **Our window:** enterprise-priced and global. Alberta mid-market is not their priority.
- Source: HammerTech blog, Oct 2025

---

## 2. Regulatory Validation — WCB Alberta (Direct Contact)

### Phone Call — April 28, 2026
- Contact method: Direct phone call by Xavion Dean
- Regulatory body: Workers' Compensation Board of Alberta

**Finding 1 — WCB premium reduction NOT possible via AI (confirmed):**
AI surveillance footage cannot directly lower WCB premiums. Premium reductions require:
- Certificate of Recognition (COR) via certified auditor
- 2-3 years of improved claims history
- Enrollment in the PIR (Partnerships in Injury Reduction) program
- **Implication:** Removed "lower your WCB premiums" from headline pitch. Confirmed correct.

**Finding 2 — Legal liability reduction IS valid (confirmed):**
Timestamped surveillance evidence of PPE compliance has significant value in civil litigation.
Companies currently have zero documented evidence of daily safety compliance when incidents
lead to lawsuits.
- One avoided settlement = $500K–$2M saved
- SiteIQ at $700/month = $8,400/year
- **ROI math:** Product pays for itself if it contributes to avoiding one lawsuit in its lifetime
- **Implication:** "Incident defense evidence" is a legitimate third value prop. Unlocks legal
  and finance budgets, not just safety budgets.

**Alberta tort law caveat:**
WCB system generally provides employers tort immunity for WCB-covered injuries. Exceptions
exist: independent contractors, gross negligence, third-party claims. Research further before
pitching to legal teams. Do not overstate until exceptions are precisely understood.

---

## 3. Technology Validation — It Actually Works

### Pre-trained PPE model (confirmed working May 1, 2026)
- Model: YOLOv8s fine-tuned on Roboflow Construction Site Safety dataset
- Source: VoxDroid/Construction-Site-Safety-PPE-Detection (MIT license for weights)
- Dataset: 2,801 images, 10 classes
- Reported metrics: Precision 0.95, Recall 0.80, mAP@50 87.67%
- **Live test results on Manraj (May 1):**
  - NO-Hardhat: 0.85–0.89 confidence, consistently detected ✓
  - NO-Safety Vest: 0.92–0.95 confidence, consistently detected ✓
  - NO-Mask: 0.87–0.91 confidence, consistently detected ✓

### Full pipeline confirmed working (May 1, 2026)
- ✅ OpenCV webcam capture → YOLO inference on RTX 4080 → violation detection
- ✅ Debounce (5 frames) + cooldown (60s) → 900 raw detections → 3 alerts (as designed)
- ✅ JPEG snapshot uploaded to S3 (ca-central-1 bucket, private)
- ✅ Violation row inserted into Supabase Postgres with image URL + timestamp
- ✅ Twilio SMS received on supervisor phone within ~5-8 seconds of violation

### Academic research consensus (2020-2025)
- YOLOv3 through YOLO11 consistently achieve 77-95% mAP on PPE detection in
  real construction conditions across multiple independent research groups and datasets
- **What this proves:** This is not experimental technology. It is reproducible.
- Sources: Frontiers in Built Environment (2020), ScienceDirect (2025)

---

## 4. Program Validation — External Credibility

### Edmonton Unlimited Student Founders: Grow — Accepted
- Backed by Alberta Innovates, City of Edmonton, PrairiesCan
- Allan Waine confirmed: pivot from GridSync to SiteIQ approved conditional on
  MVP + industry validation by May 12, 2026
- Allan's direct insight (April 21): energy software sales cycles are long —
  construction has faster buyer access
- Program provides: bi-weekly mentors, legal/accounting advisors,
  demo night Aug 17, $500 honorarium on completion
- **What this proves:** A credible regional institution validated us as a
  fundable student-stage team

---

## 5. What We Still Need to Prove

### Customer-buyer validation (target: before May 26)
- Need: one conversation with a GC owner or sub-trade operations manager who could be a buyer
- Key question to ask: *"When someone gets hurt on your site, do you have any documented
  proof of your safety compliance from that day?"*
- Owner: Xavion (his construction contacts)
- **This is the missing piece.** WCB validates the problem is legally real.
  A GC conversation validates that a customer will actually pay.

### AGPL-3.0 license resolution (before customer #1)
- Ultralytics YOLO is licensed AGPL-3.0 — requires resolution before taking payment
- Action: email `licensing@ultralytics.com` in Phase 4-5, explain student startup situation
- Alternative: switch to Apache-2.0 YOLO fork (adds ~20h integration work)

### Worker consent and PIPA compliance (before any pilot deployment)
- Alberta PIPA + PIPEDA require worker notification and consent before filming
- Action: one-hour consult with Alberta tech privacy lawyer (~$300-500)
- Add to Edmonton Unlimited "what we need" list — they have lawyers in advisor pool