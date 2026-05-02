# Cordon Safety — Open Questions (QUESTIONS.md)

Things to research, verify, or ask about. Move to NOTES.md or PROOF.md once answered.
Add a date when you log a question. Strike through when answered.

**Last updated:** May 1, 2026 (Phase 4 complete)

---

## Legal / Licensing

- [ ] **AGPL-3.0 resolution** — Email `licensing@ultralytics.com` before customer #1.
  Ask about startup license. Reference: BUILD_PATHWAY.md §13.
  *Owner: Manraj | Timeline: Phase 5*

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

- [ ] **SALUS API** — Does SALUS have a public API? Could Cordon Safety violations feed directly
  into a SALUS incident report? This could be a strong integration story.

- [ ] **COR audit value** — Can timestamped violation data from Cordon Safety help a company
  prepare for their COR audit? Does the auditor care about compliance tracking data
  beyond incident records?

---

## Infrastructure / Phase 5

- [x] ~~**S3 pre-signed URLs** — DONE. Added `/api/signed-url` route using
  `@aws-sdk/s3-request-presigner`. 1-hour expiry. `useSignedUrl()` hook in ViolationCard
  and DetailPanel.~~ *(Resolved May 1, 2026)*

- [x] ~~**Demo mode** — DONE. DemoModeBar component loads pre-seeded fake violations
  via `lib/demo-data.ts`.~~ *(Resolved May 1, 2026)*

- [ ] **Supabase RLS policies** — What policies are needed on the `violations` table?
  Supervisors should read their site's violations. Admins read everything.
  Write this before deploying the dashboard publicly.

- [ ] **Amplify env vars** — Dashboard needs in Amplify console:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
  (last 4 are server-side only for the `/api/signed-url` route).

- [ ] **Amplify build config** — Set app root to `dashboard/` in Amplify Advanced settings.
  Verify `next build` works in production mode before deploying.

- [ ] **Stub pages** — cameras/, history/, reports/, settings/, account/ pages are
  empty stubs. Decide which to flesh out for Demo Day vs defer.

- [ ] **Custom domain** — `dashboard.cordonsafety.app` or similar. Purchase domain,
  configure in Amplify. Phase 5 task.
