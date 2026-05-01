# Industry Validation Log

## Market-Level Validation (External — Proves the Model Works)

### CompScience — $37.6M raised (Series A + B)
- Backed by Nationwide insurance and Swiss Re (A-rated reinsurers)
- Proves: AI computer vision for construction safety is a fundable,
  scalable business model
- Their model: bundle AI free with workers' comp insurance policy
- Our differentiation: pure SaaS, no insurance license required,
  Canadian market, mid-market pricing ($500-900/month vs their
  enterprise-only insurance play)
- Source: CompScience.com, Benzinga funding coverage

### Voxel — $83M raised
- Pure-play AI safety platform, enterprise-focused
- Proves: standalone AI safety SaaS (not bundled with insurance)
  is a viable business
- Their gap: enterprise pricing ($3K-$10K+/month), no Alberta
  mid-market focus
- Source: Crunchbase, Voxel.ai

### SALUS — 140,000 workers on platform (Canadian)
- Canadian construction safety SaaS, no AI vision currently
- Proves: Canadian GCs already pay for and use digital safety
  software — market is not averse to SaaS tools
- Our opportunity: SALUS does paperwork, not vision.
  We are the vision layer they don't have.
- Source: SALUS official site

### HammerTech Intelligence — AI features launching 2026
- 20,000+ sites globally, just launched AI-powered safety features
- Proves: the industry is actively moving toward AI safety in 2026,
  not resisting it
- Our window: they are enterprise-priced and global. Alberta
  mid-market is not their focus.
- Source: HammerTech blog, Oct 2025

---

## Regulatory Validation (Direct — WCB Alberta)

### WCB Alberta Phone Call — April 28, 2026
- Contact method: Direct phone call by Xavion Dean
- Regulatory body: Workers' Compensation Board of Alberta

**Finding 1 — Premium reduction confirmed NOT possible via AI:**
WCB confirmed that AI surveillance footage cannot directly
lower a company's WCB premiums. Premium reductions require:
- Certificate of Recognition (COR) via certified auditor
- 2-3 years of improved claims history
- Enrollment in the PIR program
- Implication: we removed WCB premium savings from our headline
  pitch. This is confirmed correct.

**Finding 2 — Legal liability reduction confirmed VALID:**
WCB confirmed that timestamped surveillance evidence of PPE
compliance has significant value when workers pursue civil
litigation against employers. Companies currently have zero
documented evidence of daily safety compliance when incidents
lead to lawsuits.
- One avoided settlement = $500K-$2M saved
- SiteIQ at $700/month = $8,400/year
- ROI math: product pays for itself if it contributes to
  avoiding one lawsuit in its lifetime
- Implication: "Incident defense evidence" is a legitimate
  third value proposition. Unlocks legal + finance budgets,
  not just safety budgets.

**Note on Alberta tort law:**
WCB system generally prevents workers from suing employers
directly for WCB-covered injuries (tort immunity). Exceptions
exist: independent contractors, gross negligence, third-party
claims. Research further before pitching to legal teams.
Do not overstate this value prop before understanding
the exceptions precisely.

---

## Technology Validation

### Pre-trained PPE model — VoxDroid/Construction-Site-Safety-PPE-Detection
- Model: YOLOv8s trained 200 epochs on Roboflow Construction
  Site Safety dataset
- Dataset: 2,801 images, 10 classes
  (Hardhat, NO-Hardhat, Safety Vest, NO-Safety Vest, Person,
  Mask, NO-Mask, Safety Cone, machinery, vehicle)
- Reported metrics: Precision 0.95, Recall 0.80, mAP@50 87.67%
- Proves: off-the-shelf PPE detection at 87%+ accuracy is
  achievable without custom training. We fine-tune later
  on Alberta-specific footage.
- Source: github.com/VoxDroid/Construction-Site-Safety-PPE-Detection

### Academic research consensus (2020-2025)
- YOLOv3 through YOLO11 architectures consistently achieve
  77-95% mAP on PPE detection in real construction conditions
- Multiple independent research groups, multiple datasets,
  consistent results
- Proves: this is not experimental technology. It works.
- Source: Frontiers in Built Environment (2020),
  ScienceDirect (2025), multiple

---

## Program Validation

### Edmonton Unlimited Student Founders: Grow — Accepted
- Backed by Alberta Innovates, City of Edmonton, PrairiesCan
- Allan Waine confirmed: pivot from GridSync to SiteIQ approved
  conditional on MVP + industry validation by May 12
- Allan's direct insight (April 21 interview): energy software
  sales cycles are long — construction has faster buyer access
- Program provides: bi-weekly mentors, legal/accounting advisors,
  demo night Aug 17, $500 honorarium on completion
- Proves: credible regional institution validated us as a
  fundable student-stage team

---

## What We Still Need

### Customer-buyer validation (before May 26)
- Need: one conversation with an actual GC owner or
  sub-trade operations manager who could be a buyer
- Question to ask: "When someone gets hurt on your site,
  do you have any documented proof of your safety
  compliance from that day?"
- Owner: Xavion (his construction contacts)
- Timeline: before May 26 (before Xavion joins full-time)
- This is the missing piece. WCB validates the problem
  is legally real. A GC validates the customer will pay.

### License resolution (before customer #1)
- Ultralytics AGPL-3.0 license requires resolution before
  we take any payment
- Action: email licensing@ultralytics.com in Phase 4-5