# SiteIQ — Open Questions (QUESTIONS.md)

Things to research, verify, or ask about. Move to NOTES.md or PROOF.md once answered.
Add a date when you log a question. Strike through when answered.

**Last updated:** May 1, 2026

---

## Legal / Licensing

- [ ] **AGPL-3.0 resolution** — Email `licensing@ultralytics.com` before customer #1.
  Ask about startup license. Reference: BUILD_PATHWAY.md §13.
  *Owner: Manraj | Timeline: Phase 4-5*

- [ ] **Alberta tort law exceptions** — WCB provides employer tort immunity for covered injuries,
  but exceptions exist (independent contractors, gross negligence, third-party claims).
  How often do these exceptions apply on Alberta construction sites?
  Does the "incident defense evidence" value prop still hold if tort immunity is broad?
  *Research before pitching to legal/finance buyers.*

- [ ] **PIPA compliance checklist** — What exactly is needed for a lawful pilot deployment?
  - Worker notification signage wording?
  - Consent process for existing workforce?
  - Data retention policy specifics?
  *Owner: Edmonton Unlimited legal advisor referral | Timeline: before any pilot*

---

## Technology

- [ ] **GPU not showing in main.py** — CUDA 13.1 confirmed, PyTorch cu126 installed,
  but sometimes model shows CPU. Investigate whether `model.to('cuda')` is being called
  after every restart. Verify with `python -c "import torch; print(torch.cuda.is_available())"`.

- [ ] **Baseball cap false positive rate** — BUILD_PATHWAY.md notes the model may flag
  baseball caps as helmets ~30% of the time. Test this. Document result in NOTES.md.

- [ ] **Low light performance** — How does model perform in dim lighting?
  Alberta winter = low light + toques under hardhats = known accuracy issue.
  Test and document before pitching to customers.

- [ ] **FPS measurement** — What FPS are we actually getting on the RTX 4080?
  Run a 60-second session and log the average. Should be 20-30+ FPS on GPU.

- [ ] **RTSP camera connection** — How do we swap `CAMERA_INDEX = 0` (webcam) for an
  actual IP camera RTSP URL? What format does `cv2.VideoCapture()` expect?
  E.g., `rtsp://admin:password@192.168.1.100:554/stream`

---

## Product / Business

- [ ] **Customer-buyer conversation** — Before May 26, Xavion needs to speak with one GC
  owner or sub-trade ops manager. Key question: *"When someone gets hurt, do you have
  documented proof of PPE compliance from that day?"*

- [ ] **Pilot pricing** — $500-900/month is the target range. What would make a GC choose
  the $900 tier over the $500 tier? What features justify it?

- [ ] **SALUS API** — Does SALUS have a public API? Could SiteIQ violations feed directly
  into a SALUS incident report? This could be a strong integration story.

- [ ] **COR audit value** — Can timestamped violation data from SiteIQ help a company
  prepare for their COR audit? Does the auditor care about compliance tracking data
  beyond incident records?

---

## Infrastructure / Phase 4+

- [ ] **S3 pre-signed URLs** — How to generate a pre-signed URL with expiry for the
  dashboard image viewer? boto3: `s3.generate_presigned_url('get_object', ...)`
  What expiry time is right? 1 hour? 24 hours?

- [ ] **Supabase RLS policies** — What policies are needed on the `violations` table?
  Supervisors should read their site's violations. Admins read everything.
  Write this before deploying the dashboard.

- [ ] **Amplify env vars** — What env vars does the dashboard need in Amplify console?
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Are there others?

- [ ] **Demo mode** — Phase 5 requires a "demo mode" button that loads pre-seeded fake
  violations so we can demo without running the webcam. How to seed realistic data?
  Script that inserts 20-30 violation rows with realistic timestamps + fake image URLs?
