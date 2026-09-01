/**
 * test-snapshot.mjs — suite for the snapshot upload path.
 * Phase 3, Step 3.3b. Design: ADR 0004.
 *
 * Run the dashboard first (`npm run dev`), then:
 *   node scripts/test-snapshot.mjs
 *
 * ⚠ THIS SUITE WRITES REAL OBJECTS TO YOUR REAL S3 BUCKET.
 *
 * They are 1x1 JPEGs under `violations/<throwaway-org-uuid>/...`, and the
 * teardown deletes every one it created. If a run crashes hard, the leftovers
 * are findable by their org UUID, which is printed at startup.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT IT PROVES
 *
 *   1. A site that opted in gets an upload URL; one that did not, does not
 *   2. The URL is scoped to ONE key and ONE content type — changing either
 *      makes S3 reject it, so it cannot be repurposed
 *   3. Confirming works, and is safe to repeat
 *   4. Confirming WITHOUT uploading is refused and leaves the key NULL —
 *      the server never records a reference to an object it has not seen
 *   5. A device cannot confirm another device's violation
 *   6. The recorded key is exactly violations/<org>/<site>/<violation>.jpg
 * ─────────────────────────────────────────────────────────────────────────
 */

import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  apiBaseUrl,
  check,
  finish,
  generateProvisioningToken,
  loadEnv,
  requireEnv,
  section,
  serviceClient,
  sha256Hex,
  splitApiKey,
} from "./lib/common.mjs";

loadEnv();

const db = serviceClient();
const BASE = apiBaseUrl();
const TAG = `zz-test-snapshot-${Date.now()}`;

const s3 = new S3Client({
  region: requireEnv("S3_REGION"),
  credentials: {
    accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
  },
});
const BUCKET = requireEnv("S3_BUCKET_NAME");

/** A genuine, minimal 1x1 JPEG. Real bytes, so S3 stores a real object. */
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof" +
    "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB" +
    "AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

const IP = { p: "203.0.113.51", main: "203.0.113.52", conf: "203.0.113.53" };

const created = { org: null, user: null, sites: [], cameras: [], devices: [], keys: [] };

// ─── helpers ────────────────────────────────────────────────────────

function payload(cameraId, extra = {}) {
  return {
    violation_type: "no_hardhat",
    confidence: 0.91,
    detected_at: new Date().toISOString(),
    camera_id: cameraId,
    idempotency_key: randomUUID(),
    ...extra,
  };
}

async function ingest(apiKey, body, ip = IP.main) {
  const res = await fetch(`${BASE}/api/v1/violations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function confirm(apiKey, violationId, ip = IP.conf) {
  const res = await fetch(`${BASE}/api/v1/violations/${violationId}/snapshot`, {
    method: "POST",
    headers: { "x-forwarded-for": ip, Authorization: `Bearer ${apiKey}` },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function provisionDevice(label, siteId) {
  const token = generateProvisioningToken();
  const { data, error } = await db
    .from("devices")
    .insert({
      organization_id: created.org,
      site_id: siteId,
      name: `${TAG}-${label}`,
      status: "pending",
      provisioning_token_hash: sha256Hex(token),
      provisioning_token_expires_at: new Date(Date.now() + 48 * 3600e3).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`fixture device ${label}: ${error.message}`);
  created.devices.push(data.id);

  const res = await fetch(`${BASE}/api/v1/devices/provision`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": IP.p },
    body: JSON.stringify({ provisioning_token: token }),
  });
  const out = await res.json();
  if (res.status !== 200) throw new Error(`provision ${label}: ${res.status}`);
  return { id: data.id, apiKey: out.api_key, ...splitApiKey(out.api_key) };
}

async function objectExists(key) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return head.ContentLength ?? 0;
  } catch {
    return null;
  }
}

// ─── setup / teardown ───────────────────────────────────────────────

async function setup() {
  const { data: org, error: e1 } = await db
    .from("organizations").insert({ name: TAG, slug: TAG }).select("id").single();
  if (e1) throw new Error(`org: ${e1.message}`);
  created.org = org.id;
  console.log(`  fixture org: ${org.id}`);

  const attester = randomUUID();
  const { error: e2 } = await db.from("users").insert({
    id: attester, organization_id: org.id,
    email: `${TAG}@example.invalid`, role: "org_admin", status: "active",
  });
  if (e2) throw new Error(`user: ${e2.message}`);
  created.user = attester;

  const attestation = {
    pipa_attestation_completed: true,
    pipa_attestation_by: attester,
    pipa_attestation_at: new Date().toISOString(),
  };

  const { data: sites, error: e3 } = await db.from("sites").insert([
    { organization_id: org.id, name: `${TAG}-on`, timezone: "America/Edmonton",
      snapshot_mode: true, ...attestation },
    { organization_id: org.id, name: `${TAG}-off`, timezone: "America/Edmonton",
      snapshot_mode: false, ...attestation },
  ]).select("id, snapshot_mode");
  if (e3) throw new Error(`sites: ${e3.message}`);
  const on = sites.find((s) => s.snapshot_mode).id;
  const off = sites.find((s) => !s.snapshot_mode).id;
  created.sites.push(on, off);

  const { data: cams, error: e4 } = await db.from("cameras").insert([
    { organization_id: org.id, site_id: on, name: `${TAG}-cam-on` },
    { organization_id: org.id, site_id: off, name: `${TAG}-cam-off` },
  ]).select("id, site_id");
  if (e4) throw new Error(`cameras: ${e4.message}`);
  const camOn = cams.find((c) => c.site_id === on).id;
  const camOff = cams.find((c) => c.site_id === off).id;
  created.cameras.push(camOn, camOff);

  return { on, off, camOn, camOff };
}

async function teardown() {
  // ⚠ DO NOT make this failure silent again.
  //
  // It was `catch {}` on the first pass, which hid something that matters far
  // more than test litter: the allclear-app IAM user has no s3:DeleteObject
  // permission, so nothing in this product can remove an image from the bucket.
  //
  // That is fine for Phase 3, which never deletes. It is NOT fine before a
  // pilot: ADR 0007 retention removes imagery while keeping event rows, and an
  // Alberta PIPA deletion request requires actually deleting the picture of the
  // person who asked. Both are impossible with the current policy, and the
  // failure mode would have been "we told a worker we deleted their image and
  // we did not".
  const undeleted = [];
  for (const key of created.keys) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    } catch (err) {
      undeleted.push({ key, reason: err?.name ?? String(err) });
    }
  }
  if (undeleted.length > 0) {
    console.log(`\n  ⚠ Could not delete ${undeleted.length} test object(s) from S3:`);
    for (const u of undeleted) console.log(`      ${u.reason}  ${u.key}`);
    console.log(
      "\n      If this says AccessDenied, the app's IAM policy is missing\n" +
        "      s3:DeleteObject. Retention and PIPA deletion both need it.\n" +
        "      Remove these objects by hand for now.",
    );
  }
  if (created.devices.length) {
    await db.from("violations").delete().in("device_id", created.devices);
    await db.from("devices").delete().in("id", created.devices);
  }
  if (created.cameras.length) await db.from("cameras").delete().in("id", created.cameras);
  if (created.sites.length) await db.from("sites").delete().in("id", created.sites);
  if (created.user) await db.from("users").delete().eq("id", created.user);
  if (created.org) await db.from("organizations").delete().eq("id", created.org);
  await db.from("rate_limit_counters").delete().like("bucket", "ip:203.0.113.%");
  await db.from("rate_limit_counters").delete().like("bucket", "key:%");
}

// ─── the suite ──────────────────────────────────────────────────────

async function run() {
  try { await fetch(BASE, { method: "HEAD" }); }
  catch { console.error(`Cannot reach ${BASE}. Run: npm run dev`); process.exit(1); }

  const { on, off, camOn, camOff } = await setup();
  const devOn = await provisionDevice("on", on);
  const devOn2 = await provisionDevice("on2", on);
  const devOff = await provisionDevice("off", off);

  // ── 1. The upload URL is issued only when it should be ─────────────
  section("1. An opted-in site gets an upload URL");

  const r1 = await ingest(devOn.apiKey, payload(camOn, { snapshot_requested: true }));
  check("ingestion returns 201", r1.status === 201, `got ${r1.status} ${JSON.stringify(r1.body)}`);
  check("snapshot_enabled is true", r1.body?.snapshot_enabled === true);
  check("snapshot_upload is present", r1.body?.snapshot_upload !== null);
  check("it pins Content-Type to image/jpeg",
    r1.body?.snapshot_upload?.content_type === "image/jpeg");
  check("it expires in 300 seconds", r1.body?.snapshot_upload?.expires_in === 300);

  const uploadUrl = r1.body.snapshot_upload.url;
  const expectedKey = `violations/${created.org}/${on}/${r1.body.violation_id}.jpg`;
  check("the URL points at violations/<org>/<site>/<violation>.jpg",
    decodeURIComponent(new URL(uploadUrl).pathname).endsWith(expectedKey),
    new URL(uploadUrl).pathname);
  check("the signature carries a 300s expiry",
    new URL(uploadUrl).searchParams.get("X-Amz-Expires") === "300",
    new URL(uploadUrl).searchParams.get("X-Amz-Expires"));
  created.keys.push(expectedKey);

  section("1b. No URL when the device did not ask");
  const r1b = await ingest(devOn.apiKey, payload(camOn));
  check("snapshot_upload is null", r1b.body?.snapshot_upload === null);
  check("snapshot_enabled still reports the site setting", r1b.body?.snapshot_enabled === true);

  section("1c. A site that did NOT opt in refuses the whole request");
  const r1c = await ingest(devOff.apiKey, payload(camOff, { snapshot_requested: true }));
  check("returns 400", r1c.status === 400, `got ${r1c.status}`);
  check("code is snapshot_mode_disabled", r1c.body?.code === "snapshot_mode_disabled");

  // ── 2. The URL cannot be repurposed ────────────────────────────────
  section("2. The presigned URL is scoped to one object and one type");

  const swapped = new URL(uploadUrl);
  swapped.pathname = swapped.pathname.replace(/[^/]+\.jpg$/, `${randomUUID()}.jpg`);
  const wrongPath = await fetch(swapped, {
    method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG,
  });
  check("PUT to a different key is rejected by S3",
    wrongPath.status === 403, `got ${wrongPath.status}`);

  const wrongType = await fetch(uploadUrl, {
    method: "PUT", headers: { "Content-Type": "text/html" }, body: JPEG,
  });
  check("PUT with a different Content-Type is rejected by S3",
    wrongType.status === 403, `got ${wrongType.status}`);

  // ── 3. Confirm before upload ───────────────────────────────────────
  section("3. Confirming before uploading is refused, and records nothing");

  // A FRESH violation that nothing above has PUT to, deliberately. An earlier
  // draft reused r1 — and when the §2 wrong-Content-Type PUT unexpectedly
  // SUCCEEDED, it created the object and this test passed a 200 instead of the
  // 409 it exists to demand. One real defect then produced four confusing
  // failures downstream. Isolating the fixture keeps a §2 regression inside §2.
  const virgin = await ingest(devOn.apiKey, payload(camOn, { snapshot_requested: true }));
  created.keys.push(`violations/${created.org}/${on}/${virgin.body.violation_id}.jpg`);

  const early = await confirm(devOn.apiKey, virgin.body.violation_id);
  check("returns 409", early.status === 409, `got ${early.status} ${JSON.stringify(early.body)}`);
  check("code is snapshot_not_uploaded", early.body?.code === "snapshot_not_uploaded");

  const { data: rowEarly } = await db.from("violations")
    .select("snapshot_s3_key").eq("id", virgin.body.violation_id).single();
  check("snapshot_s3_key is still NULL", rowEarly.snapshot_s3_key === null);

  // ── 4. Upload, then confirm ────────────────────────────────────────
  section("4. Upload to the URL, then confirm");

  const put = await fetch(uploadUrl, {
    method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG,
  });
  check("S3 accepts the PUT", put.ok, `got ${put.status}`);

  const size = await objectExists(expectedKey);
  check("the object is really in the bucket", size !== null && size > 0, `size ${size}`);

  const ok = await confirm(devOn.apiKey, r1.body.violation_id);
  check("confirm returns 200", ok.status === 200, `got ${ok.status} ${JSON.stringify(ok.body)}`);
  check("it reports the deterministic key", ok.body?.snapshot_s3_key === expectedKey,
    ok.body?.snapshot_s3_key);
  check("already_confirmed is false the first time", ok.body?.already_confirmed === false);

  const { data: rowSet } = await db.from("violations")
    .select("snapshot_s3_key, event_hash").eq("id", r1.body.violation_id).single();
  check("the row now carries the key", rowSet.snapshot_s3_key === expectedKey);
  check("the event_hash is unchanged — snapshot_s3_key is not a sealed column",
    rowSet.event_hash === r1.body.event_hash);

  section("4b. Confirming twice is safe");
  const again = await confirm(devOn.apiKey, r1.body.violation_id);
  check("returns 200 again", again.status === 200, `got ${again.status}`);
  check("already_confirmed is true", again.body?.already_confirmed === true);
  check("the key is unchanged", again.body?.snapshot_s3_key === expectedKey);

  // ── 5. Ownership ───────────────────────────────────────────────────
  section("5. A device cannot confirm another device's violation");

  const stolen = await confirm(devOn2.apiKey, r1.body.violation_id);
  check("returns 404, not 403", stolen.status === 404, `got ${stolen.status}`);
  check("code is violation_not_found", stolen.body?.code === "violation_not_found");

  const ghost = await confirm(devOn.apiKey, randomUUID());
  check("a non-existent violation returns the SAME 404",
    ghost.status === 404 && JSON.stringify(ghost.body) === JSON.stringify(stolen.body),
    JSON.stringify(ghost.body));

  const junk = await confirm(devOn.apiKey, "not-a-uuid");
  check("a malformed id returns the SAME 404 (leaks nothing about what exists)",
    junk.status === 404 && JSON.stringify(junk.body) === JSON.stringify(stolen.body),
    `${junk.status} ${JSON.stringify(junk.body)}`);

  const noAuth = await fetch(
    `${BASE}/api/v1/violations/${r1.body.violation_id}/snapshot`,
    { method: "POST", headers: { "x-forwarded-for": IP.conf } },
  );
  check("no Authorization header returns 401", noAuth.status === 401, `got ${noAuth.status}`);

  // ── 6. Opt-out between upload and confirm ──────────────────────────
  section("6. A site switched off between upload and confirm is respected");

  const r6 = await ingest(devOn.apiKey, payload(camOn, { snapshot_requested: true }));
  const key6 = `violations/${created.org}/${on}/${r6.body.violation_id}.jpg`;
  created.keys.push(key6);
  await fetch(r6.body.snapshot_upload.url, {
    method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG,
  });

  await db.from("sites").update({ snapshot_mode: false }).eq("id", on);
  const afterOptOut = await confirm(devOn.apiKey, r6.body.violation_id);
  check("confirm is refused with 400", afterOptOut.status === 400, `got ${afterOptOut.status}`);
  check("code is snapshot_mode_disabled", afterOptOut.body?.code === "snapshot_mode_disabled");

  const { data: row6 } = await db.from("violations")
    .select("snapshot_s3_key").eq("id", r6.body.violation_id).single();
  check("no image reference was recorded for the opted-out site",
    row6.snapshot_s3_key === null);
  check("the uploaded object still exists — it becomes an orphan for the weekly cleanup",
    (await objectExists(key6)) !== null);

  await db.from("sites").update({ snapshot_mode: true }).eq("id", on);
}

// ─── entry point ────────────────────────────────────────────────────

console.log(`Testing the snapshot path against ${BASE}`);
console.log(`  bucket: ${BUCKET}`);
try {
  await run();
} catch (err) {
  console.error(`\nSuite aborted: ${err.message}`);
  process.exitCode = 1;
} finally {
  await teardown();
}
finish();
