# All Clear — Production-Ready Implementation Plan v3

> **Goal:** Deploy a real, multi-tenant, legally compliant, security-hardened production system — ready to onboard whichever customer signs first. Not a demo.
> **Approach:** Privacy law first (PIPA), then schema, then security, then features, then polish.
> **Total estimate:** ~12–18 days of focused work across 7 phases.

---

> [!CAUTION]
> **This codebase is heavily LLM-assisted.** LLM-generated code carries roughly 2.7× the vulnerability rate of human-written code and is especially prone to broken access control (IDOR), improper auth, and secret exposure. Every step's output will be treated as a junior developer's PR — with special attention to access control, auth, and input handling. A SAST scan of the full repo will run before any pilot deployment.

---

## How Every Step Works (Hard Requirements)

Every single step in this plan follows this structure:

1. **WHAT** — the specific change, file, and code
2. **WHY** — what breaks or what risk exists without it
3. **HOW IT CONNECTS** — what depends on this, what this depends on, what role it plays
4. **WHAT IF SKIPPED** — the concrete consequence of doing it wrong or not doing it
5. **YOUR TEST** — an explicit command/action you run yourself, with exact PASS vs FAIL criteria

After each phase: a summary of "what's now true about the system that wasn't before" and "what's still unprotected."

---

## Branding Rule — No Use of the Word "AI"

> [!WARNING]
> **The word "AI" must not appear anywhere in customer-facing materials.** This includes: the landing page, the login page, the dashboard UI, meta tags, page titles, marketing copy, signage templates, and any documentation a customer or investor might see.
>
> **Use instead:** "computer vision", "automated detection", "real-time monitoring", "safety compliance system", or describe the specific capability ("detects missing hard hats in real time").
>
> **Why:** "AI" is a commoditized buzzword in 2026. Every startup says "AI-powered." It triggers skepticism, not credibility. Describing the *specific technology* (computer vision, YOLOv8, edge inference) sounds more competent and differentiated. Customers buy solutions, not acronyms.
>
> **Internal exception:** Internal dev docs (CLAUDE.md, this plan's process notes) may reference "LLM-assisted" or "LLM-generated" when discussing how the code was built — that's a development process note, not branding. But even internally, prefer specificity over the generic term.

---

## Security Audit Findings (Current State)

Before we start, here's what we found auditing the codebase today:

| # | Severity | Issue | File |
|---|----------|-------|------|
| 1 | 🔴 **HIGH** | [`/api/signed-url`](file:///d:/all-clear/all-clear/dashboard/app/api/signed-url/route.ts) has no explicit auth or authorization check. No tenant isolation — any authenticated user can request any org's images. No input validation on the `key` param (path traversal risk within S3 bucket). | `signed-url/route.ts` |
| 2 | 🔴 **HIGH** | No security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) configured anywhere. | [`next.config.ts`](file:///d:/all-clear/all-clear/dashboard/next.config.ts) |
| 3 | 🟠 **MEDIUM** | S3 image remote patterns allow ANY S3 bucket (`*.s3.amazonaws.com`), not just yours. | `next.config.ts` |
| 4 | 🟠 **MEDIUM** | No retry/queue for S3 uploads or Twilio SMS — violation data can be silently lost. | [`storage.py`](file:///d:/all-clear/all-clear/detection/src/storage.py), [`alerts.py`](file:///d:/all-clear/all-clear/detection/src/alerts.py) |
| 5 | 🟠 **MEDIUM** | Root [`.gitignore`](file:///d:/all-clear/all-clear/.gitignore) doesn't cover `.env.local`, `.env.production`, etc. | `.gitignore` |
| 6 | 🟠 **MEDIUM** | Python dependencies completely unpinned in [`pyproject.toml`](file:///d:/all-clear/all-clear/detection/pyproject.toml) — any `pip install` could pull a compromised version. | `pyproject.toml` |
| 7 | 🟡 **LOW** | No explicit `ACL='private'` on S3 `put_object()` calls. | `storage.py` |
| 8 | 🟡 **LOW** | Bucket name mismatch between detection `.env.example` and dashboard env. | config files |

**Positive findings:** No hardcoded secrets in tracked files ✅, proper key separation (anon vs service role) ✅, no audio capture ✅, no continuous footage storage ✅, private S3 bucket ✅, middleware protects most dashboard routes ✅.

---

## Phase 0 — Privacy & Legal Compliance (Alberta PIPA) 🔴 BLOCKING — DO FIRST
*Estimated time: 1.5–2 days*

> [!CAUTION]
> This is a workplace-surveillance product capturing images of identifiable workers. Alberta's PIPA (Personal Information Protection Act) requires reasonable notification to employees before collecting personal information, data minimization, and secure handling. **Without this layer, deploying at ANY customer site is illegal.** This phase is also a sales weapon — you can tell any prospective customer "we've built PIPA compliance into the product, so you don't have to figure it out."

---

### Step 0.1 — Verify and enforce no audio capture at the edge

#### [MODIFY] [`detection/src/main.py`](file:///d:/all-clear/all-clear/detection/src/main.py)

**WHAT:** After `cv2.VideoCapture()` is opened, explicitly disable audio capture by setting `cap.set(cv2.CAP_PROP_AUDIO_STREAM, -1)` (if supported) and add a code comment + assertion that documents and verifies no audio is ever captured. Add a `verify_no_audio(cap)` function that checks audio-related properties and logs/asserts on startup.

**WHY:** Recording private conversations without consent is illegal under both PIPA and the federal Criminal Code (s.184). Even if OpenCV doesn't capture audio by default today, an RTSP stream from an IP camera *can* contain audio. If a future code change or camera config accidentally enables it, you need a hard stop.

**HOW IT CONNECTS:** This is the outermost data collection point in the entire system. Everything downstream (S3, Supabase, dashboard) only sees what this code captures. If audio leaks in here, it contaminates the whole pipeline.

**WHAT IF SKIPPED:** A camera with a built-in microphone could silently record worker conversations. That's a Criminal Code violation, not just a PIPA issue. Discovery of this in a pilot would end the company.

**YOUR TEST:**
- **PASS:** Run `python src/main.py`, check the startup logs — you should see `[PRIVACY] Audio capture: DISABLED (verified)`. Add a unit test that opens a capture device and asserts audio properties are disabled.
- **FAIL:** If you see any log line suggesting audio channels > 0, or if the assertion fires.

---

### Step 0.2 — Document data minimization basis in the codebase

#### [NEW] `docs/PRIVACY.md`

**WHAT:** Create a privacy documentation file that states:
1. **What is collected:** Only individual JPEG snapshots of confirmed PPE violations (after debounce). Never continuous video. Never audio.
2. **Reasonable purpose:** Workplace safety compliance monitoring under Alberta OHS Act s.2. The employer has a legal duty to ensure PPE is worn; this system documents enforcement.
3. **Less intrusive alternative considered:** Manual safety officers conducting periodic inspections. This alternative is less effective (coverage gaps, human fatigue, no permanent record) and more intrusive (requires a person physically watching workers).
4. **Retention basis:** 90 days default, aligned with typical OHS investigation windows.
5. **Data flow:** Edge device → S3 (ca-central-1) → Supabase (ca-central-1). Raw video never leaves the site.

**WHY:** PIPA s.11(1) requires that collection of personal information must be limited to what is reasonable for the stated purpose. If Noralta's privacy officer (or a worker's lawyer) asks "why are you collecting this and have you considered less intrusive means?", this document is the answer.

**HOW IT CONNECTS:** This document is referenced by the worker notification signage (Step 0.3) and the customer attestation flow (Step 0.4). It's also the basis for the data retention policy in Phase 6.

**WHAT IF SKIPPED:** You cannot articulate to a customer, a regulator, or a judge why you collect what you collect. That's a losing position in any PIPA complaint.

**YOUR TEST:**
- **PASS:** Read `docs/PRIVACY.md` and confirm it answers: what, why, less intrusive alternative, how long, where stored.
- **FAIL:** If any of those five questions is unanswered.

---

### Step 0.3 — Worker notification module: signage templates

#### [NEW] `docs/templates/worker_notice_en.md`
#### [NEW] `docs/templates/worker_notice_fr.md` (bilingual federal sites)

**WHAT:** Create downloadable signage templates that a customer prints and posts at monitored areas. Content:
- "This area is monitored by automated PPE compliance cameras"
- What is recorded (violation snapshots only, no audio, no continuous video)
- Why (workplace safety under OHS Act)
- Who has access (site supervisor, safety manager)
- How long data is kept (90 days)
- Who to contact with questions (customer's safety officer + All Clear support email)
- Must be posted at every monitored entry point before cameras go live

**WHY:** PIPA s.13(1) and s.15 require that individuals be notified before their personal information is collected. For workplace surveillance, the accepted standard is clear, visible signage at monitored locations. Without it, every snapshot is an unlawful collection. This also removes friction from sales — you hand the customer ready-made signage instead of making them figure out the legal requirements themselves.

**HOW IT CONNECTS:** The customer attestation (Step 0.4) references these templates. The device provisioning flow (Phase 3) requires attestation before a device can be activated. This creates a legal chain: templates exist → customer attests workers were notified → device activates → collection begins.

**WHAT IF SKIPPED:** Every violation snapshot captured without worker notification is an unlawful collection of personal information under PIPA. A worker complaint to the Alberta OIPC could result in an investigation, an order to destroy all collected data, and public reporting — a catastrophic outcome for a company whose product *is* data collection.

**YOUR TEST:**
- **PASS:** Open the template files, confirm they contain all 6 items listed above, and are written in plain language a construction worker would understand.
- **FAIL:** Missing any of the 6 items, or written in legalese.

---

### Step 0.4 — Customer PIPA attestation gate on device activation

#### [NEW] `docs/migrations/000_pipa_attestation.sql`

**WHAT:** Add to the `sites` table:
- `pipa_attestation_completed` (boolean, default false)
- `pipa_attestation_by` (uuid FK → users, nullable)
- `pipa_attestation_at` (timestamptz, nullable)

Add a database constraint or application-level check: a device's `status` cannot be set to `'active'` unless the site it belongs to has `pipa_attestation_completed = true`.

**WHY:** This is the legal gate. It encodes "workers have been notified per PIPA s.15" as a hard requirement in the system, not a checkbox someone might forget. Without it, an eager admin could activate a camera before posting signage, and you'd be collecting data unlawfully.

**HOW IT CONNECTS:** This is checked by the device provisioning endpoint (Phase 3, Step 3A). When a Jetson calls `POST /api/v1/devices/provision`, the backend checks the device's site → if `pipa_attestation_completed = false`, the provisioning is rejected with a clear error message. The Settings page (Phase 4) will have a UI for the org_admin to complete the attestation.

**WHAT IF SKIPPED:** There is no system-level enforcement of the notification requirement. It becomes a "process" issue — which means it will eventually be missed. The first time it's missed at a customer site, All Clear is legally liable as the data processor.

**YOUR TEST:**
- **PASS:** In Supabase SQL editor, insert a device for a site where `pipa_attestation_completed = false`, then try to update that device's status to `'active'`. It should fail (constraint violation or trigger rejection).
- **FAIL:** If the device activates without attestation.

---

### Step 0.5 — Verify S3 bucket is truly private (no public access)

#### Verification only — no code change

**WHAT:** Log into the AWS Console → S3 → your bucket (`cordon-safety-violations-dev` or whatever the production bucket is). Confirm:
1. "Block all public access" is ON (all 4 checkboxes)
2. The bucket policy does not contain `"Principal": "*"` or `"Effect": "Allow"` for public access
3. No objects have individual public ACLs

**WHY:** The signed-URL route generates temporary access. If the bucket itself is public, those URLs are meaningless — anyone can access any image directly. The detection code stores the public-form URL (`https://bucket.s3.amazonaws.com/key`), so if the bucket were public, every image would be accessible to anyone who can guess the key pattern.

**HOW IT CONNECTS:** The entire image access model depends on the bucket being private. The signed-URL route (which we'll secure in Phase 2) is the *only* authorized path to images.

**WHAT IF SKIPPED:** A single misconfigured bucket setting and every worker violation photo you've ever captured becomes publicly accessible on the internet. That's a PIPA breach, a PR disaster, and possibly a class-action trigger.

**YOUR TEST:**
- **PASS:** In AWS Console, try to open `https://cordon-safety-violations-dev.s3.amazonaws.com/violations/00000000-0000-0000-0000-000000000001/<any-key>.jpg` directly in a browser. You should get `AccessDenied` XML.
- **FAIL:** If the image loads.

---

### Step 0.6 — Add explicit `ACL='private'` to S3 uploads

#### [MODIFY] [`detection/src/storage.py`](file:///d:/all-clear/all-clear/detection/src/storage.py)

**WHAT:** In the `put_object()` call, add `ACL='private'` explicitly. Also add `ServerSideEncryption='AES256'` to ensure encryption at rest.

**WHY:** Currently the code relies on the bucket-level default for privacy. That's one config change away from exposing every image. Belt-and-suspenders: even if someone misconfigures the bucket, each individual object is explicitly private. The encryption ensures data at rest is protected per PIPA s.34.

**HOW IT CONNECTS:** This is defense-in-depth for Step 0.5. The bucket-level setting is the wall; this is the lock on each door inside.

**WHAT IF SKIPPED:** If a future AWS admin accidentally disables "Block Public Access" on the bucket (perhaps during a debugging session), every new upload would be public. With per-object ACL, each upload stays private regardless.

**YOUR TEST:**
- **PASS:** After uploading a test violation, check the object's properties in AWS Console → Permissions tab. It should show `Bucket owner full control` and no public access. The `Server-side encryption` field should show `AES256`.
- **FAIL:** If the ACL shows any public grant, or encryption is `None`.

---

### Step 0.7 — Audit-log every VIEW of a worker image

#### [MODIFY] [`dashboard/app/api/signed-url/route.ts`](file:///d:/all-clear/all-clear/dashboard/app/api/signed-url/route.ts)

**WHAT:** Before generating the signed URL, log an entry to the `audit_log` table: `{ action: 'viewed_violation_image', target_type: 'violation_snapshot', target_id: <s3_key>, user_id: <from session> }`. This happens *before* the URL is returned, so even if the user never actually views the image, the access request is recorded.

**WHY:** PIPA gives workers a right to know who has accessed their personal information. If a worker asks "who has seen photos of me?", you need an answer. Most audit logs only track mutations (create/update/delete) — but for a surveillance product, *viewing* an image of a person is itself a privacy-relevant action.

**HOW IT CONNECTS:** Depends on the `audit_log` table (created in Phase 1). The audit log is also used for enterprise trust (section 7 of architecture doc) and COR audit reporting.

**WHAT IF SKIPPED:** You cannot answer the question "who looked at images of worker X?" That question will be asked — by a privacy officer, a worker, or a regulator. Having no answer is a PIPA compliance failure.

**YOUR TEST:**
- **PASS:** Open the dashboard, click a violation card to view the image. Then query `SELECT * FROM audit_log WHERE action = 'viewed_violation_image' ORDER BY created_at DESC LIMIT 1;` — you should see a row with your user_id and the S3 key.
- **FAIL:** If no audit_log row exists after viewing an image.

> [!NOTE]
> Step 0.7 depends on the `audit_log` table from Phase 1. During implementation, we'll either create the table early or queue the audit writes for after Phase 1.

---

### Phase 0 Completion Summary

**What's now true:**
- Audio capture is impossible (enforced in code with assertion)
- Data minimization is documented with legal basis
- Worker notification templates exist and are downloadable
- Device activation requires PIPA attestation (hard gate)
- S3 bucket is verified private with per-object ACL + encryption
- Image access is audit-logged

**What's still unprotected:**
- Database has no multi-tenancy or RLS (anyone with DB access sees everything)
- Signed-URL route has no auth/authz check (any authenticated user can access any image)
- No security headers on the dashboard
- Python dependencies are unpinned
- No retry queues for uploads/SMS

---

## Phase 1 — Database Schema v2 Migration 🔴
*Estimated time: 1.5–2 days*

This is the foundation everything else is built on. Every table after this carries `organization_id`, which is the column RLS will filter on.

---

### Step 1.1 — Create the `organizations` table

#### [NEW] `docs/migrations/001_schema_v2.sql` (first section)

**WHAT:** Create the `organizations` table:
```sql
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  plan        text NOT NULL DEFAULT 'pilot'
              CHECK (plan IN ('pilot', 'starter', 'pro', 'enterprise')),
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'suspended')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

**WHY:** This is the top of the multi-tenant hierarchy. Every other table points up to this. Without it, there's no concept of "whose data is this?" — which means no tenant isolation, no RLS, no ability to serve multiple customers from one database.

**HOW IT CONNECTS:** `organizations.id` becomes the `organization_id` FK on every other tenant-scoped table. RLS policies (Phase 2) filter on this column. The Settings page (Phase 4) displays org info. The landing page contact form (Phase 5) could create a new org.

**WHAT IF SKIPPED:** You cannot have multi-tenancy. Period. Every feature that follows — RLS, role-based access, per-customer dashboards — depends on this table existing.

**YOUR TEST:**
- **PASS:** In Supabase SQL editor: `SELECT * FROM organizations;` returns an empty table with the correct columns. Then: `INSERT INTO organizations (name, slug) VALUES ('Test Org', 'test-org');` succeeds. Then: `INSERT INTO organizations (name, slug, plan) VALUES ('Bad Plan', 'bad', 'invalid');` fails with a CHECK constraint violation.
- **FAIL:** Table doesn't exist, or the CHECK constraint doesn't reject invalid plan values.

---

### Step 1.2 — Create the `users` table (application-level profiles)

#### [NEW] `docs/migrations/001_schema_v2.sql` (continued)

**WHAT:** Create `users` table linking Supabase Auth identities to organizations and roles:
```sql
CREATE TABLE users (
  id                uuid PRIMARY KEY,  -- matches auth.users.id
  organization_id   uuid NOT NULL REFERENCES organizations(id),
  email             text NOT NULL UNIQUE,
  full_name         text,
  role              text NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('org_admin', 'supervisor', 'viewer')),
  phone             text,
  status            text NOT NULL DEFAULT 'invited'
                    CHECK (status IN ('active', 'invited', 'disabled')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

**WHY:** Supabase Auth handles "who are you?" (authentication). This table handles "what are you allowed to do?" (authorization). The `role` column drives UI visibility (what nav items you see), API access (what endpoints you can call), and RLS policies (what data you can query). The `id` is the same UUID as `auth.users.id` — this is how RLS connects a database session to an organization.

**HOW IT CONNECTS:** RLS policies (Phase 2) do `SELECT organization_id FROM users WHERE id = auth.uid()` — that's this table. The NavRail (Phase 4) reads `role` to show/hide Settings. The Settings page lets org_admins manage this table. SMS alert routing uses `phone` from this table.

**WHAT IF SKIPPED:** There is no way to map a logged-in user to an organization or a role. RLS cannot function. Every user sees every org's data. Role-based access is impossible.

**YOUR TEST:**
- **PASS:** `INSERT INTO users (id, organization_id, email, role) VALUES (gen_random_uuid(), '<org_id from step 1.1>', 'test@test.com', 'org_admin');` succeeds. `INSERT INTO users (id, organization_id, email, role) VALUES (gen_random_uuid(), '<org_id>', 'bad@test.com', 'hacker');` fails (CHECK constraint).
- **FAIL:** Invalid roles are accepted.

---

### Step 1.3 — Create `site_assignments`, `devices`, `audit_log` tables

#### [NEW] `docs/migrations/001_schema_v2.sql` (continued)

**WHAT:** Three more tables:

**`site_assignments`** — junction table for the many-to-many relationship between users and sites:
```sql
CREATE TABLE site_assignments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id),
  user_id           uuid NOT NULL REFERENCES users(id),
  site_id           uuid NOT NULL REFERENCES sites(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, site_id)
);
```

**`devices`** — Jetson edge units, each bound to one site:
```sql
CREATE TABLE devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  site_id             uuid NOT NULL REFERENCES sites(id),
  name                text NOT NULL,
  provisioning_token  text,  -- one-time, nulled after use
  api_key_hash        text,  -- bcrypt hash, never raw key
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'revoked')),
  last_seen_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

**`audit_log`** — immutable record of who did what:
```sql
CREATE TABLE audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id),
  user_id           uuid,  -- nullable for system actions
  action            text NOT NULL,
  target_type       text NOT NULL,
  target_id         uuid,
  metadata          jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

**WHY (each):**
- `site_assignments`: A supervisor at Noralta might manage the Main Yard but not the Pipeline site. Without this table, every supervisor sees every site — which violates least-privilege and makes the product less useful for large customers.
- `devices`: Each Jetson needs a revocable identity (architecture doc §10). Without this, you cannot provision, monitor, or disconnect an edge device. The `api_key_hash` is hashed, not plaintext — same reason you hash passwords.
- `audit_log`: PIPA requires knowing who accessed personal information. Enterprise customers expect an audit trail. This table records every significant action. It's append-only — no UPDATE or DELETE policies.

**YOUR TEST:**
- **PASS:** All three tables exist. `INSERT INTO audit_log (organization_id, action, target_type) VALUES ('<org_id>', 'test_action', 'test');` succeeds. `DELETE FROM audit_log WHERE id = '<id>';` — this should work now (we'll restrict it via RLS in Phase 2).
- **FAIL:** Any table is missing or FKs don't validate.

---

### Step 1.4 — Modify existing tables to add multi-tenancy columns

#### [NEW] `docs/migrations/001_schema_v2.sql` (continued)

**WHAT:** Add `organization_id` + other new columns to `sites`, `cameras`, `violations`:

```sql
-- Sites
ALTER TABLE sites
  ADD COLUMN organization_id uuid REFERENCES organizations(id),
  ADD COLUMN timezone text NOT NULL DEFAULT 'America/Edmonton',
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Cameras
ALTER TABLE cameras
  ADD COLUMN organization_id uuid REFERENCES organizations(id),
  ADD COLUMN device_id uuid REFERENCES devices(id),
  ADD COLUMN zone text,
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Violations
ALTER TABLE violations
  ADD COLUMN organization_id uuid REFERENCES organizations(id),
  ADD COLUMN site_id uuid REFERENCES sites(id),
  ADD COLUMN device_id uuid REFERENCES devices(id),
  ADD COLUMN resolved_by uuid REFERENCES users(id),
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
-- Rename image_url → snapshot_s3_key
ALTER TABLE violations RENAME COLUMN image_url TO snapshot_s3_key;
```

**WHY:** Without `organization_id` on every row, RLS has nothing to filter on. The existing tables work for a single-tenant demo but are fundamentally incapable of isolating customer data.

**HOW IT CONNECTS:** After this, every row in the database can answer "who does this belong to?" That's the prerequisite for RLS (Phase 2), for the dashboard showing only your data (Phase 4), and for the API refusing to return another customer's violations (Phase 3).

**WHAT IF SKIPPED:** RLS policies have no column to filter on. Multi-tenancy is impossible. You're stuck as a single-customer system forever.

**YOUR TEST:**
- **PASS:** `SELECT organization_id, timezone, status FROM sites LIMIT 1;` returns the new columns (values will be NULL/default for existing rows). `\d violations` shows `snapshot_s3_key` not `image_url`.
- **FAIL:** Column doesn't exist or the rename didn't apply.

---

### Step 1.5 — Seed migration: link existing data to a dev organization

#### [NEW] `docs/migrations/001_schema_v2.sql` (final section)

**WHAT:** Create the "All Clear Dev" organization and backfill all existing rows:
```sql
INSERT INTO organizations (id, name, slug, plan)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'All Clear Dev', 'allclear-dev', 'pilot');

-- Link your existing Supabase Auth user to the org
INSERT INTO users (id, organization_id, email, full_name, role, status)
VALUES (
  '<your-auth-user-id>',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'manrajwazir@gmail.com',
  'Manraj Wazir',
  'org_admin',
  'active'
);

-- Backfill organization_id on existing data
UPDATE sites SET organization_id = 'aaaaaaaa-0000-0000-0000-000000000001';
UPDATE cameras SET organization_id = 'aaaaaaaa-0000-0000-0000-000000000001';
UPDATE violations SET organization_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Backfill site_id on violations from camera join
UPDATE violations v
SET site_id = c.site_id
FROM cameras c
WHERE v.camera_id = c.id;

-- Now make organization_id NOT NULL
ALTER TABLE sites ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE cameras ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE violations ALTER COLUMN organization_id SET NOT NULL;
```

**WHY:** Your existing data (your real photos, your test violations) needs to belong to an org. After this, RLS can protect it. The NOT NULL constraint at the end ensures no future row can be inserted without an org — closing the door permanently.

**YOUR TEST:**
- **PASS:** `SELECT COUNT(*) FROM violations WHERE organization_id IS NULL;` returns `0`. `SELECT COUNT(*) FROM violations WHERE site_id IS NULL;` returns `0`. `INSERT INTO violations (camera_id, violation_type, confidence, snapshot_s3_key) VALUES (...);` fails because `organization_id` is NOT NULL.
- **FAIL:** Any NULL organization_id rows remain, or inserts without org succeed.

---

### Step 1.6 — Update TypeScript types

#### [MODIFY] [`lib/supabase/types.ts`](file:///d:/all-clear/all-clear/dashboard/lib/supabase/types.ts)

**WHAT:** Add TS types for all new tables (`Organization`, `User`, `Device`, `SiteAssignment`, `AuditLog`). Update `Violation`, `Camera`, `Site` types to include new columns. Rename `image_url` → `snapshot_s3_key` in the `Violation` type.

**WHY:** TypeScript types are the contract between your database and your frontend code. If the types don't match the schema, you'll get runtime errors that the compiler can't catch. After the schema migration, the old types are lying to the compiler.

**YOUR TEST:**
- **PASS:** `cd dashboard && npx tsc --noEmit` compiles with zero errors. Any component referencing `image_url` gets a compile error pointing you to use `snapshot_s3_key` instead.
- **FAIL:** Type errors on build, or components silently reference columns that no longer exist.

---

### Phase 1 Completion Summary

**What's now true:**
- Database has 8 tables with full multi-tenant hierarchy: `organizations` → `users`/`sites` → `cameras`/`devices`/`site_assignments` → `violations` → `audit_log`
- Every row carries `organization_id` — the column RLS will filter on
- Existing data is linked to "All Clear Dev" org
- TypeScript types match the new schema
- PIPA attestation fields exist on `sites` (from Phase 0)

**What's still unprotected:**
- **RLS is not enabled yet** — the columns exist but the database isn't filtering on them
- Signed-URL route still has no auth check
- No security headers
- No role-based access control in the dashboard

---

## Phase 2 — Security: RLS + Auth + OWASP Hardening 🔴
*Estimated time: 2–3 days*

> [!IMPORTANT]
> This is the biggest, most critical phase. It covers RLS (the wall between tenants), auth role wiring, OWASP Top 10 2025 protections, security headers, input validation, and rate limiting. Every step here prevents a specific, named attack.

---

### Step 2.1 — Enable RLS and write org-isolation policies on ALL tables

#### [NEW] `docs/migrations/002_rls_policies.sql`

**WHAT:** For every tenant-scoped table, enable RLS and create the base isolation policy. **Critical:** the policy checks `users.status = 'active'` — not just that the user exists. This means a disabled user's active session immediately sees zero data, even if their JWT hasn't expired yet.

```sql
-- Pattern for each table:
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON sites
  FOR ALL
  USING (
    organization_id = (
      SELECT organization_id FROM users
      WHERE id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM users
      WHERE id = auth.uid() AND status = 'active'
    )
  );
-- Repeat for: cameras, violations, users, site_assignments, devices, audit_log
```

Special cases:
- `organizations`: users can only SELECT their own org (`id = (SELECT organization_id FROM users WHERE id = auth.uid() AND status = 'active')`)
- `audit_log`: INSERT only (no UPDATE, no DELETE — immutable)

> [!IMPORTANT]
> **Why `AND status = 'active'` matters:** Supabase Auth sessions use two JWTs: an **access token** (lives 1 hour) and a **refresh token** (lives 7 days). When you disable a user by setting `users.status = 'disabled'`, their tokens are still valid — Supabase Auth doesn't know about your `users` table. Without the status check in RLS, a disabled user can keep querying data for up to 7 days. With `AND status = 'active'`, the subquery returns NULL the moment you flip the status, so `organization_id = NULL` is false and **every query returns zero rows immediately** — even with a valid JWT. The database becomes the kill switch.

**WHY:** Without RLS, a forgotten `WHERE` clause in any query leaks every customer's data. With RLS, the database itself enforces isolation — even buggy application code cannot return another org's rows. This is the single most important security control in the entire system. It also means you can confidently onboard multiple customers on the same database without worrying about data leaks — whether it's a construction company, a pipeline operator, or a warehouse.

**HOW IT CONNECTS:** This makes the `organization_id` column (Phase 1) actually do something. The dashboard's Supabase client uses the `anon` key (which respects RLS). The Python backend uses the `service_role` key (which bypasses RLS — intentionally, because the backend stamps org_id from the device record).

**WHAT IF SKIPPED:** One forgotten WHERE clause, one buggy join, one careless API route — and one customer sees another customer's violation photos. That's a PIPA breach, a contract violation, and the end of customer trust. RLS makes this category of bug *impossible* at the database level.

**YOUR TEST:**
- **PASS:** Log into the dashboard as your user (org: All Clear Dev). In the Supabase SQL editor using the anon key (not service role), run: `SELECT * FROM violations;` — you should see only your org's violations. Create a second test org (e.g. "Acme Construction") + user, get their JWT, and query violations — they should see ZERO rows. This proves the wall works regardless of who the customer is.
- **FAIL:** If the Acme user sees All Clear Dev's violations.
- **DISABLED USER TEST:** Set your own `users.status = 'disabled'` (you can flip it right back). Without logging out, refresh the dashboard — it should show zero violations, zero cameras, nothing. Flip status back to `'active'`, refresh — everything returns. This proves the RLS kill switch works.
- **FAIL:** If a disabled user still sees data.

---

### Step 2.2 — Role-scoped RLS: supervisor site restriction, viewer read-only

#### [NEW] `docs/migrations/002_rls_policies.sql` (continued)

**WHAT:** Layer role-based policies on top of org isolation:

```sql
-- Supervisors: can only see violations from their assigned sites
CREATE POLICY supervisor_site_scope ON violations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'org_admin')
    OR site_id IN (SELECT site_id FROM site_assignments WHERE user_id = auth.uid())
  );

-- Supervisors can UPDATE violations (resolve/false-positive) only at assigned sites
CREATE POLICY supervisor_resolve ON violations
  FOR UPDATE USING (
    site_id IN (SELECT site_id FROM site_assignments WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'org_admin')
  )
  WITH CHECK (
    resolution_status IN ('resolved', 'false_positive')
  );

-- Viewers: SELECT only on all tables (no INSERT/UPDATE/DELETE policies apply)
-- This is achieved by NOT creating INSERT/UPDATE/DELETE policies for the viewer role
```

**WHY:** Org isolation says "Noralta can't see another company's data." Role scoping says "Supervisor A at the Main Yard can't see violations from the Pipeline site they don't manage." This is the principle of least privilege — each person sees only what they need.

**YOUR TEST:**
- **PASS:** Create a supervisor user assigned to Site A only. Log in as them. `SELECT * FROM violations WHERE site_id = '<site_b_id>';` returns ZERO rows. `UPDATE violations SET resolution_status = 'resolved' WHERE site_id = '<site_a_id>' AND id = '<violation_id>';` succeeds. Same UPDATE on Site B's violation → fails.
- **FAIL:** Supervisor sees violations from unassigned sites, or can resolve violations at sites they're not assigned to.

---

### Step 2.3 — Secure the signed-URL route (HIGH severity fix)

#### [MODIFY] [`dashboard/app/api/signed-url/route.ts`](file:///d:/all-clear/all-clear/dashboard/app/api/signed-url/route.ts)

**WHAT:** Three fixes:
1. **Explicit auth check:** Call `supabase.auth.getUser()` inside the route handler. If no user, return 401.
2. **Tenant isolation:** Look up the S3 key in the `violations` table to confirm it belongs to the requesting user's organization. If not, return 403.
3. **Input validation:** Validate that the `key` parameter starts with `violations/` and doesn't contain `..` (path traversal prevention).

**WHY:** This is the #1 finding from the security audit. Currently, any authenticated user can request a signed URL for *any* S3 key, including keys belonging to other organizations. That means if Noralta and a second customer both use All Clear, either could view the other's violation photos by guessing or enumerating S3 keys.

**HOW IT CONNECTS:** This route is the only authorized path to violation images. The DetailPanel, ViolationCard, and History page all call this route to display images. If this route is insecure, every image in the system is accessible to every user.

**WHAT IF SKIPPED:** Any authenticated user can download any organization's violation photos. If you have two customers — say a construction firm and a pipeline company — either could view the other's worker photos. That's a data breach by design.

**YOUR TEST:**
- **PASS:** (1) Call `GET /api/signed-url?key=violations/<your-org's-key>` while logged in → 200 + signed URL. (2) Call with a key belonging to a different org → 403. (3) Call with `key=../../../etc/passwd` → 400 (invalid key format). (4) Call while not logged in → 401.
- **FAIL:** Any of the above returns a signed URL when it shouldn't.

---

### Step 2.4 — Enforce org-ownership in ALL service-role/device-key API routes (A01: Broken Access Control / IDOR)

#### [MODIFY] All `dashboard/app/api/` routes that use service-role key or device key

**WHAT:** For every API route that uses the service-role key (bypasses RLS) or accepts a device key:
1. Extract the authenticated identity (user session or device API key)
2. Look up the `organization_id` from that identity
3. Verify the target resource belongs to that org before any operation
4. Never trust client-supplied IDs — always re-derive org context from the authenticated identity

Specifically:
- `POST /api/v1/violations` — device key → device row → org_id. Stamp it on the violation. Never accept `organization_id` from the request body.
- `POST /api/v1/devices/provision` — validate the provisioning token → get the device's site → get the org. Don't accept org_id from the client.
- `GET /api/reports/export` — user session → user row → org_id. Filter all queries by it.
- `PATCH /api/v1/violations/:id` — user session → user row → org_id. Verify the violation belongs to their org before updating.

This pattern must hold for every future API route — org context always comes from the authenticated identity, never from client input.

**WHY:** RLS protects queries made with the `anon` key. But the service-role key *bypasses RLS entirely* — that's its purpose. So every route using it must manually enforce the same isolation that RLS would have provided. If you skip this, a malicious device or a crafted API request can write violations into another org's data or read their violations. This matters the moment you have more than one customer — which is the entire business model.

**WHAT IF SKIPPED:** An attacker with a valid device key could insert violations into another org's dashboard. Or a curious user could craft an API request to view another org's reports.

**YOUR TEST:**
- **PASS:** Using a device key bound to Org A, send `POST /api/v1/violations` with `organization_id: <org_b_id>` in the body. The route should IGNORE the body's org_id and stamp Org A's id instead (from the device record). Query the violation — it should have Org A's id. This simulates a compromised device trying to poison another customer's data.
- **FAIL:** The violation is stored with Org B's id.

---

### Step 2.5 — Security headers (A02: Security Misconfiguration)

#### [MODIFY] [`dashboard/next.config.ts`](file:///d:/all-clear/all-clear/dashboard/next.config.ts)

**WHAT:** Add security headers to the Next.js config:
```typescript
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-XSS-Protection', value: '0' },  // disabled, CSP is better
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://<your-bucket>.s3.ca-central-1.amazonaws.com; connect-src 'self' https://<supabase-url> wss://<supabase-url>; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none';" },
  ],
}],
```

Also restrict the `images.remotePatterns` to your specific S3 bucket, not `*.s3.amazonaws.com`.

**WHY:**
- `X-Frame-Options: DENY` — prevents clickjacking (embedding your dashboard in an iframe to steal clicks)
- `X-Content-Type-Options: nosniff` — prevents browsers from misinterpreting files as scripts
- `Strict-Transport-Security` — forces HTTPS, prevents downgrade attacks
- `Content-Security-Policy` — prevents XSS by restricting what scripts/styles/images can load
- `Permissions-Policy` — explicitly disables camera/microphone/geolocation access in the browser (you do NOT need these — all capture happens on the Jetson)

**WHAT IF SKIPPED:** Your dashboard is vulnerable to clickjacking, MIME sniffing attacks, and XSS injection. A malicious page could embed your dashboard in a hidden iframe and trick a supervisor into clicking "resolve all violations."

**YOUR TEST:**
- **PASS:** Run `curl -I https://your-dashboard-url.vercel.app/dashboard` (or localhost). The response headers include all 6 headers listed above. Open Chrome DevTools → Network → check the response headers on any page load.
- **FAIL:** Any of the 6 headers is missing.

---

### Step 2.6 — Strip stack traces from client-facing error responses

#### [MODIFY] All `dashboard/app/api/` routes

**WHAT:** Wrap every API route handler in a try/catch. In the catch block: log the full error server-side (for debugging), but return only a generic message to the client: `{ error: "Internal server error" }` with status 500. Never include stack traces, SQL queries, or internal paths in the response.

**WHY:** A stack trace leaks your internal file paths, database table names, column names, and library versions. An attacker uses this information to craft targeted attacks. It's OWASP A02 (Security Misconfiguration).

**YOUR TEST:**
- **PASS:** Trigger an error (e.g., pass a malformed UUID to an API route). The response body is `{ "error": "Internal server error" }` — no stack trace, no file paths, no SQL.
- **FAIL:** The response contains a stack trace or internal error details.

---

### Step 2.7 — Input validation with Zod on all API routes

#### [NEW] `dashboard/lib/validations.ts`

**WHAT:** Define Zod schemas for every API route's input:
```typescript
import { z } from 'zod';

export const signedUrlSchema = z.object({
  key: z.string()
    .startsWith('violations/')
    .regex(/^[a-zA-Z0-9\-_\/\.]+$/, 'Invalid characters in key')
    .max(500),
});

export const violationSubmitSchema = z.object({
  violation_type: z.enum(['no_hardhat', 'no_safety_vest', 'no_mask']),
  confidence: z.number().min(0).max(1),
  detected_at: z.string().datetime(),
  snapshot: z.string().max(5_000_000), // 5MB base64 limit
});

export const provisionDeviceSchema = z.object({
  provisioning_token: z.string().min(32).max(128),
});

// etc for every route
```

Apply `schema.parse(input)` at the top of every API route handler. On validation failure, return 400 with the Zod error messages (these are safe — they describe the schema, not your internals).

**WHY:** Without input validation, a malformed request can cause unexpected behavior — SQL injection (Supabase's client library parameterizes queries, but defense-in-depth matters), path traversal (the signed-URL key), oversized uploads that exhaust memory, or type coercion bugs. Validating at the boundary catches bad input before it touches any business logic.

**YOUR TEST:**
- **PASS:** `POST /api/v1/violations` with `{ "violation_type": "evil_hack", "confidence": 999 }` → returns 400 with a clear validation error. With valid input → 200.
- **FAIL:** Invalid input is accepted and processed.

---

### Step 2.8 — Supply chain security (A03)

#### [NEW] `.github/dependabot.yml` or equivalent

**WHAT:**
1. Pin Python dependencies in `pyproject.toml` to exact versions (`ultralytics==8.2.x`, etc.)
2. Commit `package-lock.json` (should already exist) and `requirements.txt` / lockfile for Python
3. Add Dependabot config for both npm and pip
4. Run `npm audit` and `pip-audit` — fix any findings
5. Install and run `gitleaks` on the full git history to check for any accidentally committed secrets
6. Add a `.github/workflows/security.yml` CI step that runs `npm audit`, `pip-audit`, and `gitleaks` on every PR

**WHY:** Unpinned dependencies mean any `pip install` could pull a different (potentially compromised) version. Dependabot alerts you when a dependency has a known CVE. Gitleaks catches secrets that were committed and then "deleted" (they're still in git history).

**YOUR TEST:**
- **PASS:** `npm audit` returns 0 critical/high vulnerabilities. `pip-audit` returns clean. `gitleaks detect --source .` returns no findings. `pyproject.toml` has pinned versions.
- **FAIL:** Any critical vulnerability found, or a secret detected in git history (which means you need to rotate that secret immediately).

---

### Step 2.9 — Rate limiting on public-facing endpoints

#### [NEW] `dashboard/lib/rate-limit.ts`

**WHAT:** Implement simple in-memory rate limiting (or use `@upstash/ratelimit` with Redis for production). Apply to:
- Auth endpoints: 5 requests/minute per IP (prevents brute-force magic link abuse)
- Device provision: 3 requests/minute per IP (provisioning is one-time)
- Device heartbeat: 120 requests/minute per device key (1 every 30s with margin)
- Violation ingestion: 60 requests/minute per device key (1 per cooldown period with margin)

**WHY:** Without rate limiting, an attacker can brute-force provisioning tokens, spam your SMS budget via fake violations, or overwhelm your database with requests. Rate limiting is the first line of defense against abuse.

**YOUR TEST:**
- **PASS:** Send 10 rapid requests to `/api/v1/devices/provision` with an invalid token. After the 3rd, you get `429 Too Many Requests`. Wait 60 seconds, try again — it works.
- **FAIL:** Unlimited requests are accepted.

---

### Step 2.10 — Idempotency key on violation ingestion

#### [MODIFY] `dashboard/app/api/v1/violations/route.ts`

**WHAT:** Accept an `Idempotency-Key` header (a UUID generated by the Jetson for each violation event). Before inserting, check if a violation with that idempotency key already exists. If so, return the existing violation (200), don't create a duplicate.

Store the key in a new `idempotency_key` column on `violations` with a UNIQUE constraint.

**WHY:** The Jetson has a local retry queue (Phase 3). If the internet drops during an upload, the Jetson retries when reconnected. Without idempotency, each retry creates a duplicate violation row. The supervisor gets 5 SMS alerts for the same incident. The compliance record is inflated and untrustworthy.

**YOUR TEST:**
- **PASS:** Send `POST /api/v1/violations` with `Idempotency-Key: abc-123`. Get 201. Send the exact same request again. Get 200 (not 201) with the same violation ID. Check the database — only one row exists.
- **FAIL:** Two rows are created.

---

### Step 2.11 — Auth role wiring + disabled-user session kill in dashboard

#### [MODIFY] [`lib/supabase/server.ts`](file:///d:/all-clear/all-clear/dashboard/lib/supabase/server.ts)

**WHAT:** Add `getUserWithRole()` helper that checks status:
```typescript
export async function getUserWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role, full_name, phone, status')
    .eq('id', user.id)
    .single();
  if (!profile || profile.status !== 'active') return null;  // ← KILL SWITCH
  return { ...user, ...profile };
}
```

#### [MODIFY] [`middleware.ts`](file:///d:/all-clear/all-clear/dashboard/middleware.ts)

Two responsibilities:
1. **Role-based route protection:** `/dashboard/settings` → `org_admin` only.
2. **Disabled user session kill:** After `getUser()` succeeds (valid JWT), query `users.status`. If `status !== 'active'`:
   - Call `supabase.auth.signOut()` to clear cookies
   - Redirect to `/login` with `?reason=disabled`
   - This gives a clean UX: the user sees a login page with a message, not mysterious empty data

> [!NOTE]
> **How Supabase sessions work (so you can explain this to a customer):**
> Supabase uses two tokens stored as browser cookies. The **access token** expires in 1 hour — it's the short-lived proof of identity that RLS reads. The **refresh token** lasts 7 days — it silently fetches a new access token when the old one expires. `updateSession()` in middleware handles this refresh on every page load.
>
> When you disable a user, three layers respond:
> 1. **RLS (instant):** The `AND status = 'active'` check in every RLS policy means all queries return zero rows immediately, even with a valid token.
> 2. **Middleware (next page load):** Detects `status !== 'active'`, signs them out, clears cookies, redirects to login.
> 3. **Token expiry (natural):** Even if layers 1 and 2 didn't exist, the access token expires in 1 hour and the refresh token in 7 days. But we don't rely on this — layers 1 and 2 are immediate.
>
> For truly instant revocation of a compromised account (e.g., stolen laptop), you can also call `supabase.auth.admin.signOut(userId)` from the server, which invalidates the refresh token server-side.

#### [MODIFY] [`components/layout/NavRail.tsx`](file:///d:/all-clear/all-clear/dashboard/components/layout/NavRail.tsx)
Conditionally render Settings nav item based on role.

**YOUR TEST:**
- **PASS (role):** Log in as a `supervisor` user. NavRail does not show Settings. Navigate to `/dashboard/settings` directly → redirected to `/dashboard`. Log in as `org_admin` → Settings is visible and accessible.
- **PASS (disabled user):** Log in normally. In Supabase SQL editor, set `UPDATE users SET status = 'disabled' WHERE email = 'your@email.com';`. Refresh the dashboard → you're redirected to `/login`. Try navigating directly to `/dashboard` → redirected again. Set status back to `'active'` → login works normally.
- **FAIL:** Supervisor can access Settings page, or a disabled user can still see the dashboard.

---

### Phase 2 Completion Summary

**What's now true:**
- RLS enforces org isolation at the database level — it's impossible for one org to see another's data via the dashboard
- Role-based access restricts supervisors to assigned sites, viewers to read-only
- Signed-URL route validates auth, tenant ownership, and input
- All API routes validate input with Zod schemas
- Security headers prevent clickjacking, XSS, MIME sniffing
- Rate limiting prevents brute-force and abuse
- Idempotency prevents duplicate violations from retry queues
- Dependencies are pinned and scanned
- Git history is clean of secrets

**What's still unprotected:**
- Python detection service still uses hardcoded camera ID (not device API key)
- No local retry queue on the edge device
- Dashboard pages are still stubs
- Landing page still has competitor GIF

---

## Phase 3 — Python Detection Service Updates 🟠
*Estimated time: 1.5–2 days*

---

### Step 3.1 — Device provisioning API endpoint

#### [NEW] `dashboard/app/api/v1/devices/provision/route.ts`

**WHAT:** `POST /api/v1/devices/provision` — accepts `{ provisioning_token }`, validates against `devices` table (status must be `pending`), checks PIPA attestation on the device's site, generates a crypto-random API key, stores bcrypt hash in `api_key_hash`, clears the provisioning token, sets status to `active`, returns the raw API key (shown once, never stored by the server).

**WHY:** This is how a Jetson gets its identity. Without it, edge devices either use hardcoded credentials (current state — one camera ID for everything) or have no way to authenticate at all.

**YOUR TEST:**
- **PASS:** Create a device in the DB with status `pending` and a provisioning token. `curl -X POST /api/v1/devices/provision -d '{"provisioning_token":"<token>"}' ` → 200 + API key. Check DB: token is NULL, status is `active`, `api_key_hash` is populated. Try the same token again → 400 "Token already used."
- **FAIL:** Token is reusable, or device activates without PIPA attestation on its site.

---

### Step 3.2 — Device heartbeat endpoint

#### [NEW] `dashboard/app/api/v1/devices/heartbeat/route.ts`

**WHAT:** `POST /api/v1/devices/heartbeat` — accepts device API key in `Authorization: Bearer <key>` header. Hashes the key, finds the matching device, updates `last_seen_at = now()`. Returns 200 with `{ status: "ok" }`.

**YOUR TEST:**
- **PASS:** Call with a valid device key → 200. Check `devices.last_seen_at` — it's within the last few seconds. Call with a revoked device's key → 403. Call with garbage key → 401.
- **FAIL:** Revoked device gets a 200.

---

### Step 3.3 — Violation ingestion API endpoint (DB-first, no orphaned images)

#### [NEW] `dashboard/app/api/v1/violations/route.ts`

**WHAT:** `POST /api/v1/violations` — accepts device API key + violation payload (Zod-validated). The operation order is critical and deliberate:

```
1. Validate input (Zod schema — Step 2.7)
2. Authenticate device (hash API key, look up device row)
3. Check idempotency key (Step 2.10 — return existing violation if duplicate)
4. INSERT violation row into DB with snapshot_s3_key = NULL
   → This is the legal compliance record. It is written FIRST.
   → If this fails → return 500. Nothing else happens. No orphaned image.
5. Upload image to S3 (ACL=private, ServerSideEncryption=AES256)
   → If this fails → log error, but the violation row still exists (just no photo).
   → If this succeeds → UPDATE the violation row to SET snapshot_s3_key = <key>
6. Fire SMS to assigned supervisors (best-effort, independent retry)
7. Return { id, snapshot_s3_key } to the device
```

> [!WARNING]
> **Why DB-first matters — the orphaned image problem:**
> The current code in [`main.py`](file:///d:/all-clear/all-clear/detection/src/main.py) does S3 first (line 180), then DB insert (line 191). If S3 succeeds but the DB insert fails, you get an **orphaned image** — a worker's photo sitting in S3 with no database record pointing to it. That image:
> - Cannot be displayed (no violation row references it)
> - Cannot be audit-logged (the system doesn't know it exists)
> - Cannot be retention-deleted (the cleanup job can't find it)
> - Cannot be access-controlled (no org_id association)
>
> That's a PIPA compliance failure: you're storing personal information you can't track, can't report on, and can't delete when legally required.
>
> **DB-first eliminates this entire class of bug.** The violation row is the source of truth. If it doesn't exist, nothing else happens. If it does exist but the image upload fails, you have a violation record without a photo — which is acceptable and correct (the compliance record exists, the photo is supplementary).

**Safety net — weekly S3 orphan cleanup:**

Add a scheduled job (pg_cron or Lambda) that runs weekly:
1. List all objects in the `violations/` S3 prefix
2. Cross-reference each key against `snapshot_s3_key` values in the `violations` table
3. Any S3 object with no matching DB row → delete it and log the cleanup to `audit_log`

This catches any edge cases where a partial failure leaves an orphan despite the DB-first ordering (e.g., DB insert succeeds, S3 upload succeeds, but the UPDATE to set `snapshot_s3_key` fails due to a network timeout after the upload completed).

**WHY:** This replaces the current pattern where the Python code directly calls Supabase + S3 + Twilio. Centralizing through an API means: the device never needs database credentials (just its API key), all validation happens server-side, org_id is stamped server-side (not trusted from the device), and the retry queue on the Jetson only needs to retry one HTTP call.

**YOUR TEST:**
- **PASS:** Send a valid violation with device key → 201. Check: violation row exists with correct org_id/site_id (from device, not from request). S3 object exists with private ACL. SMS was sent (or mock-logged). Dashboard shows the violation via Realtime.
- **FAIL:** org_id comes from request body instead of device record, or violation appears without auth.
- **ORPHAN TEST:** Temporarily break the S3 upload (invalid credentials). Send a violation → 201 (partial success). Check DB: violation row exists with `snapshot_s3_key = NULL`. Check S3: no orphaned image. This confirms DB-first ordering is working.
- **FAIL:** An image exists in S3 without a corresponding violation row.

---

### Step 3.4 — Update Python detection service for device auth

#### [MODIFY] [`detection/src/main.py`](file:///d:/all-clear/all-clear/detection/src/main.py)
#### [MODIFY] [`detection/src/storage.py`](file:///d:/all-clear/all-clear/detection/src/storage.py)
#### [MODIFY] [`detection/src/alerts.py`](file:///d:/all-clear/all-clear/detection/src/alerts.py)

**WHAT:**
- Replace `CAMERA_ID` hardcode with `DEVICE_API_KEY` from `.env`
- On startup: verify device key by calling heartbeat endpoint
- On violation: POST to `/api/v1/violations` instead of direct Supabase/S3/Twilio calls
- Start a background thread that calls heartbeat every 30 seconds
- Multi-camera support: read `CAMERA_RTSP_URLS` (comma-separated) from config, run detection loop for each

**YOUR TEST:**
- **PASS:** Run `python src/main.py` with `DEVICE_API_KEY` set. Startup logs show `[AUTH] Device authenticated — org: All Clear Dev, site: MVP Site`. Walk in front of camera without hardhat → violation appears in dashboard.
- **FAIL:** Any reference to hardcoded `CAMERA_ID` remains, or direct Supabase/S3 calls remain.

---

### Step 3.5 — Local event queue (outage resilience)

#### [MODIFY] [`detection/src/storage.py`](file:///d:/all-clear/all-clear/detection/src/storage.py)

**WHAT:** Add a local SQLite queue (`detection/queue.db`). On every confirmed violation:
1. Write to local queue FIRST (timestamp, violation_type, confidence, JPEG bytes, idempotency_key)
2. Attempt to POST to cloud API
3. On success: mark queued event as sent
4. On failure: log the failure, leave in queue
5. Background thread: every 30 seconds, retry unsent events with exponential backoff (30s → 60s → 120s → 240s → cap at 5 min)

**WHY:** Internet goes down on construction sites. A supervisor needs to know that even during an outage, the system was watching. If violations are lost during an outage, the compliance record has gaps — which is exactly what an auditor looks for.

**YOUR TEST:**
- **PASS:** Start detection. Disconnect from internet (disable WiFi/Ethernet). Trigger a violation (walk past camera without hardhat). Check `queue.db` — the event is there. Reconnect. Within 60 seconds, the event appears in the dashboard. Check `queue.db` — the event is marked as sent.
- **FAIL:** Events are lost during the outage, or the queue never replays.

---

### Phase 3 Completion Summary

**What's now true:**
- Edge devices authenticate with revocable API keys (not hardcoded IDs)
- All violations flow through a centralized API (org_id stamped server-side)
- Offline detections are queued locally and replayed — zero data loss
- Device online/offline status is tracked via heartbeat
- PIPA attestation is enforced before device activation

**What's still unprotected:**
- Dashboard pages are still stubs (no History, Reports, Cameras, Settings)
- Landing page still has competitor GIF
- No audit log wiring, retention automation, or PWA

---

## Phase 4 — Dashboard Pages 🟠
*Estimated time: 2.5–3 days*

Build real, functional pages against schema v2. No stubs, no "coming soon." Full design system compliance per [`dashboard-design.md`](file:///d:/all-clear/all-clear/docs/dashboard-design.md) — dark-first, monospace numerics, status-only color.

---

### Step 4.1 — History page (violation archive)

#### [MODIFY] [`app/dashboard/history/page.tsx`](file:///d:/all-clear/all-clear/dashboard/app/dashboard/history/page.tsx)
#### [NEW] `components/history/HistoryFilters.tsx`
#### [NEW] `components/history/ViolationTable.tsx`
#### [NEW] `components/history/ExportButton.tsx`

**WHAT:** Full violation archive with:
- Server-side initial fetch with filters (date range, violation type, status, camera)
- Client-side filter bar (date pickers, dropdowns, search)
- Sortable table with all violation fields (detected_at in Geist Mono, type, camera, site, confidence %, status pill, resolved_by)
- Click row → existing DetailPanel slides in
- CSV export button
- Pagination (load more / cursor-based)

**WHY:** "Can I see past violations?" is the #1 question a supervisor asks after the live demo. The history page is also the raw data behind the reports page and COR audit export. Without it, the product is a live-only alerting tool — not a compliance documentation system.

**YOUR TEST:**
- **PASS:** Open `/dashboard/history`. See your existing violations in a table. Filter by "No Hardhat" → only hardhat violations shown. Click a row → detail panel slides in. Click "Export CSV" → a .csv file downloads with the filtered violations.
- **FAIL:** Page shows "Coming Soon", or filters don't work, or CSV is empty/malformed.

---

### Step 4.2 — Cameras page (camera management)

#### [MODIFY] [`app/dashboard/cameras/page.tsx`](file:///d:/all-clear/all-clear/dashboard/app/dashboard/cameras/page.tsx)
#### [NEW] `components/cameras/CameraGrid.tsx`
#### [NEW] `components/cameras/AddCameraSheet.tsx`
#### [NEW] `components/cameras/DeviceStatusBadge.tsx`

**WHAT:** Camera management grid with:
- Cards for each camera: name, site, online/offline badge (from device heartbeat), last violation time, today's violation count
- "Add Camera" button → shadcn Sheet with form (name, site selector, RTSP URL in masked input, zone label)
- Click camera card → camera detail view showing recent violations from that camera
- Empty state for zero cameras

**YOUR TEST:**
- **PASS:** Page shows your existing camera(s) with correct status. Add a new camera → it appears in the grid. The RTSP URL is masked (shows `rtsp://****`) not in plaintext.
- **FAIL:** Page shows "Coming Soon", or RTSP URL is visible in plaintext.

---

### Step 4.3 — Reports page (COR compliance export)

#### [MODIFY] [`app/dashboard/reports/page.tsx`](file:///d:/all-clear/all-clear/dashboard/app/dashboard/reports/page.tsx)
#### [NEW] `components/reports/ReportSummary.tsx`
#### [NEW] `components/reports/ReportCharts.tsx`
#### [NEW] `components/reports/ExportReport.tsx`
#### [NEW] `app/api/reports/export/route.ts`

**WHAT:** Compliance reporting page with:
- Date range selector (presets: 7/30/90 days, custom)
- 4 summary metric cards: Total Violations, Resolution Rate (%), Avg Response Time, Most Common Type
- Charts: violations per day (bar), by type (donut), by camera (horizontal bar), response time distribution
- CSV export via authenticated API route (RLS ensures org isolation)

**WHY:** This is why the product exists (architecture doc §11, Flow D). A safety manager opens reports before a COR audit and exports the compliance record. Without this page, the product cannot fulfill its core value proposition.

**YOUR TEST:**
- **PASS:** Page loads with charts showing your actual violation data. Select "Last 30 days" → charts update. Click "Export CSV" → downloads a CSV with correct data. Log in as a different org → the export contains ZERO rows from your org.
- **FAIL:** Charts show no data, export is empty, or cross-org data leaks into the export.

---

### Step 4.4 — Settings page (admin configuration)

#### [MODIFY] [`app/dashboard/settings/page.tsx`](file:///d:/all-clear/all-clear/dashboard/app/dashboard/settings/page.tsx)

**WHAT:** Admin-only settings with sections:
1. **Organization** — name, plan badge, slug (read-only for now)
2. **Team** — user table (email, role, status), invite button (Supabase magic link), change role dropdown, disable user
3. **Sites** — list with address/timezone, add site form, PIPA attestation status per site
4. **Devices** — list with status (online/offline/pending), provision button (generates token, shown once), revoke button
5. **Alert Routing** — supervisors + phone numbers + assigned sites
6. **Detection Thresholds** — read-only display of current config values

Only `org_admin` sees the full page. `supervisor` sees a read-only summary. `viewer` is redirected (Step 2.11).

**YOUR TEST:**
- **PASS:** Log in as org_admin → all 6 sections visible. Invite a new user → they receive a magic link email. Provision a new device → token is displayed once and cannot be retrieved again. Revoke a device → its status changes to "revoked".
- **FAIL:** Non-admin users can modify settings, or provisioning token is shown more than once.

---

### Phase 4 Completion Summary

**What's now true:**
- All 4 stub pages are real, functional, and wired to live data
- History provides full violation archive with filters and CSV export
- Cameras page shows device online/offline status and allows adding cameras
- Reports page delivers the COR audit value proposition
- Settings page lets admins manage team, sites, devices, and alerts
- Everything enforces RLS — each org sees only their own data

**What's still unprotected:**
- Landing page still has competitor GIF and broken contact form
- No audit log wiring beyond image views
- No data retention automation
- No error monitoring or alerting
- No PWA

---

## Phase 5 — Landing Page Overhaul 🟡
*Estimated time: 4–6 hours*

---

#### [MODIFY] [`app/page.tsx`](file:///d:/all-clear/all-clear/dashboard/app/page.tsx)

**Remove:**
- CompScience GIF hotlink (line 71) — competitor asset, external dependency, embarrassing if noticed
- `mailto:` form action — opens mail client, unprofessional
- GitHub "SiteIQ" link (old name)

**Replace hero with:** Generated hero image or CSS-only animated detection mock (no external dependencies)

**Add/fix:**
1. **"Why All Clear"** section — Canadian data residency (PIPA), your existing cameras (no hardware), edge-first (no raw video in cloud)
2. **"How it works"** — 4-step visual matching architecture diagram
3. **Contact form** — Supabase `leads` table insert via server action (zero external services)
4. **Social proof** — Edmonton Unlimited + Alberta Innovates backing
5. **Pricing** — polish existing section

**YOUR TEST:**
- **PASS:** Open landing page. No network requests to `compscience.com`. Contact form submits → check `leads` table in Supabase. All links work. No console errors. Responsive at 375px/768px/1440px.
- **FAIL:** External requests to competitor domains, form opens mail client, or broken links.

---

## Phase 6 — Production Infrastructure & Robustness 🟢
*Estimated time: 2–3 days*

---

### Step 6.1 — Audit log wiring

#### [NEW] `lib/audit.ts`

**WHAT:** `logAuditEvent(userId, action, targetType, targetId, metadata)` helper. Wire into every mutation point: resolve/false-positive violation, add camera, invite user, provision device, revoke device, change role, complete PIPA attestation. (Image view logging is already done in Phase 0, Step 0.7.)

**YOUR TEST:**
- **PASS:** Resolve a violation in the dashboard. `SELECT * FROM audit_log WHERE action = 'resolved_violation' ORDER BY created_at DESC LIMIT 1;` → row exists with your user_id and the violation_id.
- **FAIL:** No audit_log row after a mutation.

---

### Step 6.2 — Data retention automation (90 days)

#### [NEW] `docs/migrations/003_retention_policy.sql`

**WHAT:** A PostgreSQL function + `pg_cron` job that runs daily at 3am MT:
1. Find violations older than 90 days where `resolution_status IN ('resolved', 'false_positive')`
2. Delete the S3 objects (via a Supabase Edge Function or a scheduled Lambda)
3. Set `snapshot_s3_key = NULL` on those violations (keep the metadata row for compliance records, just remove the image)
4. Log the deletion to `audit_log`

**WHY:** PIPA requires data minimization — keep only as long as needed. 90 days covers the typical OHS investigation window. The metadata row is kept (violation type, time, camera) because the compliance record itself is the product's value — the image is no longer needed.

**YOUR TEST:**
- **PASS:** Manually backdate a test violation to 91 days ago. Run the retention function. Check: `snapshot_s3_key` is NULL, S3 object is deleted, `audit_log` has a `retention_delete` entry. The violation row still exists (for compliance records).
- **FAIL:** Image or row is not cleaned up, or no audit trail of the deletion.

---

### Step 6.3 — Error monitoring (Sentry)

#### [NEW] Sentry integration in dashboard + detection service

**WHAT:** Add Sentry SDK to both the Next.js dashboard and the Python detection service. Configure:
- Source maps for frontend error tracking
- Performance monitoring (track API route latency)
- Alert rules: notify on new error types, on error rate spikes
- Device heartbeat alerting: if a device misses 3 consecutive heartbeats (90 seconds), fire a Sentry alert → which can trigger a Slack/email/SMS notification

**YOUR TEST:**
- **PASS:** Throw a test error in an API route. Check Sentry dashboard — the error appears with a full stack trace (server-side only, never exposed to the client per Step 2.6). Stop the detection service — within 90 seconds, a "device offline" alert fires.
- **FAIL:** Errors go unnoticed, or device offline is not detected.

---

### Step 6.4 — Database backups + test restore

**WHAT:** Enable Supabase Point-in-Time Recovery (PITR) on the production project. Document the restore process. Perform an actual test restore to a new project to verify it works.

**YOUR TEST:**
- **PASS:** Create a test violation. Note the timestamp. Restore to 1 minute before that timestamp on a separate Supabase project. Verify: the test violation does NOT exist in the restored database (proving the restore went to the correct point in time).
- **FAIL:** Restore fails, or the restored database is missing data it should have.

---

### Step 6.5 — CI pipeline (SAST + dependency scan + tests)

#### [NEW] `.github/workflows/ci.yml`

**WHAT:** GitHub Actions workflow that runs on every PR:
1. `npm audit --audit-level=high` (dashboard)
2. `pip-audit` (detection)
3. `gitleaks detect` (secret scanning)
4. `npx tsc --noEmit` (type checking)
5. `npm run build` (catch build errors)
6. `pytest detection/tests/` (Python tests)
7. A SAST tool (Semgrep free tier) over the full repo

Block merge if any step fails.

**YOUR TEST:**
- **PASS:** Create a PR with a deliberate type error. CI fails and blocks merge. Fix the error, push again — CI passes.
- **FAIL:** CI doesn't run, or a failing step doesn't block the merge.

---

### Step 6.6 — Device key rotation flow

**WHAT:** Add a "Rotate Key" button in Settings → Devices. Flow:
1. Admin clicks "Rotate Key" on a device
2. Backend generates a new API key, stores new hash, returns new key (shown once)
3. Old key remains valid for 24 hours (grace period for the admin to update the Jetson)
4. After 24 hours, old key is invalidated
5. Audit log records the rotation

**WHY:** If a device key is suspected compromised (Jetson stolen, employee with access leaves), you need to rotate the key without immediately killing the device (which would create a detection gap). The 24-hour grace period is the balance.

**YOUR TEST:**
- **PASS:** Rotate a device's key. Use the OLD key to call heartbeat → 200 (grace period). Use the NEW key → 200. Wait 24 hours (or simulate by backdating the rotation timestamp). Old key → 401. New key → 200.
- **FAIL:** Old key works forever, or new key doesn't work immediately.

---

### Step 6.7 — PWA support

#### [NEW] `dashboard/public/manifest.json`
#### [NEW] `dashboard/public/sw.js`
#### [NEW] `dashboard/app/api/push/subscribe/route.ts`

**WHAT:** Progressive Web App shell: manifest (app name, icons, `display: standalone`, theme color `#0A0B0F`), service worker (offline caching of dashboard shell), web push subscription endpoint. Install prompt banner in the dashboard UI.

**WHY:** This is the Phase D polish from the architecture doc. Makes the paid product feel native on mobile. Push notifications are faster, cheaper (no Twilio cost), and richer than SMS.

**YOUR TEST:**
- **PASS:** Open dashboard on Android Chrome. "Add to Home Screen" prompt appears. Install. App launches in standalone mode (no browser chrome). Trigger a violation → push notification appears.
- **FAIL:** No install prompt, or push notifications don't fire.

---

### Phase 6 Completion Summary

**What's now true:**
- Every significant action in the system is audit-logged
- Images older than 90 days are automatically deleted (PIPA compliance)
- Errors are monitored and alerted in real-time
- Database can be restored to any point in time
- Every PR goes through security scanning before merge
- Device keys can be rotated without detection gaps
- Dashboard works as a native-feeling mobile app

---

## Final Execution Order

```
Phase 0: PIPA Privacy Compliance       [1.5-2 days]  🔴 BLOCKING — DO FIRST
Phase 1: Schema v2 Migration           [1.5-2 days]  🔴 IMMEDIATELY AFTER
Phase 2: RLS + Auth + OWASP Hardening  [2-3 days]    🔴 IMMEDIATELY AFTER
Phase 3: Python Detection Updates      [1.5-2 days]  🟠 Can overlap Phase 2 end
Phase 4: Dashboard Pages               [2.5-3 days]  🟠 After Phases 1+2
Phase 5: Landing Page Overhaul         [4-6 hrs]     🟡 Any time after Phase 1
Phase 6: Production Infra + Robustness [2-3 days]    🟢 After Phase 4
──────────────────────────────────────────────────────────────
Total:                                 ~12-18 days of focused work
```

> [!IMPORTANT]
> **Before any external deployment:** Run a full SAST scan (Semgrep) over the entire repo. Review every API route for broken access control. Test RLS with two separate orgs. Verify the S3 bucket is private. Confirm no secrets in git history. This is the final gate.

---

## Process Note — LLM-Generated Code Review

This codebase is heavily LLM-assisted. At every step, the output will be treated as a junior developer's PR:

- **Access control:** Does every API route verify the caller's identity AND their right to access the specific resource? (Not just "are they logged in" but "is this *their* data?")
- **Auth:** Is the service-role key only used in trusted backend code? Is the anon key used everywhere else? Are device keys hashed, never stored raw?
- **Input handling:** Is every input validated before it touches business logic? Are error messages safe (no stack traces, no SQL, no internal paths)?
- **Secrets:** Are all secrets in `.env` (gitignored) or a secrets manager? None hardcoded, none in git history?

If any step's output fails these checks, we fix it before moving on.
