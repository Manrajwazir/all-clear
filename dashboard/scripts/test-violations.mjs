/**
 * test-violations.mjs — adversarial suite for POST /api/v1/violations.
 * Phase 3, Step 3.3. Covers the whole BUILD_CONTEXT §8 table.
 *
 * Run the dashboard first (`npm run dev`), then:
 *   node scripts/test-violations.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS SUITE IS THE IMPORTANT ONE
 *
 * device-auth.ts uses the service role, which bypasses row-level security
 * entirely. On this endpoint the application logic is the ONLY control — there
 * is no database safety net underneath it. A bug here is not an empty list, it
 * is one customer's data written into another customer's account.
 *
 * Two tests here cannot be replaced by reasoning:
 *
 *   §7  fires six identical requests SIMULTANEOUSLY and demands exactly one row
 *   §8  fires ten distinct requests SIMULTANEOUSLY from one device and then
 *       walks the resulting hash chain link by link, demanding it be a single
 *       unbroken line with no forks
 *
 * Until now the chain-safety design has been "correct by construction" — the
 * row lock in ingest_violation() means a fork cannot happen. §8 is where that
 * claim stops being an argument and becomes an observation.
 *
 *   §11 additionally proves the tamper-evidence is ENFORCED, not merely
 *       computed: it attempts to edit a sealed column using the service role,
 *       which bypasses RLS, and confirms the database still refuses.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { randomUUID } from "node:crypto";

import {
  apiBaseUrl,
  check,
  finish,
  generateProvisioningToken,
  loadEnv,
  section,
  serviceClient,
  sha256Hex,
  splitApiKey,
} from "./lib/common.mjs";

loadEnv();

const db = serviceClient();
const BASE = apiBaseUrl();
const URL_VIOLATIONS = `${BASE}/api/v1/violations`;
const URL_PROVISION = `${BASE}/api/v1/devices/provision`;

const TAG = `zz-test-violations-${Date.now()}`;

const IP = {
  p1: "203.0.113.31",
  p2: "203.0.113.32",
  p3: "203.0.113.33",
  main: "203.0.113.41",
  snap: "203.0.113.42",
  flood: "203.0.113.43",
};

const created = {
  org: null,
  user: null,
  sites: [],
  cameras: [],
  devices: [],
};

// ─── helpers ────────────────────────────────────────────────────────

function payload(cameraId, overrides = {}) {
  return {
    violation_type: "no_hardhat",
    confidence: 0.87,
    detected_at: new Date().toISOString(),
    camera_id: cameraId,
    idempotency_key: randomUUID(),
    ...overrides,
  };
}

async function submit(apiKey, ip, body) {
  const res = await fetch(URL_VIOLATIONS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  let parsed;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

async function provisionDevice(label, siteId, ip) {
  const token = generateProvisioningToken();
  const { data, error } = await db
    .from("devices")
    .insert({
      organization_id: created.org,
      site_id: siteId,
      name: `${TAG}-${label}`,
      status: "pending",
      provisioning_token_hash: sha256Hex(token),
      provisioning_token_expires_at: new Date(
        Date.now() + 48 * 3600 * 1000,
      ).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`fixture device ${label}: ${error.message}`);
  created.devices.push(data.id);

  const res = await fetch(URL_PROVISION, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ provisioning_token: token }),
  });
  const out = await res.json();
  if (res.status !== 200) {
    throw new Error(`provision ${label}: ${res.status} ${JSON.stringify(out)}`);
  }
  return { id: data.id, apiKey: out.api_key, ...splitApiKey(out.api_key) };
}

async function rowsFor(deviceId) {
  const { data } = await db
    .from("violations")
    .select("*")
    .eq("device_id", deviceId);
  return data ?? [];
}

// ─── setup / teardown ───────────────────────────────────────────────

async function setup() {
  const { data: org, error: orgErr } = await db
    .from("organizations")
    .insert({ name: TAG, slug: TAG })
    .select("id")
    .single();
  if (orgErr) throw new Error(`fixture org: ${orgErr.message}`);
  created.org = org.id;

  const attester = randomUUID();
  const { error: uErr } = await db.from("users").insert({
    id: attester,
    organization_id: org.id,
    email: `${TAG}@example.invalid`,
    full_name: "Violations Suite Fixture",
    role: "org_admin",
    status: "active",
  });
  if (uErr) throw new Error(`fixture user: ${uErr.message}`);
  created.user = attester;

  const attestation = {
    pipa_attestation_completed: true,
    pipa_attestation_by: attester,
    pipa_attestation_at: new Date().toISOString(),
  };

  const { data: sites, error: sErr } = await db
    .from("sites")
    .insert([
      // snapshot_mode OFF — the default, and the privacy posture of ADR 0001
      {
        organization_id: org.id,
        name: `${TAG}-nosnap`,
        timezone: "America/Edmonton",
        snapshot_mode: false,
        ...attestation,
      },
      // snapshot_mode ON — a site that has explicitly opted in to imagery
      {
        organization_id: org.id,
        name: `${TAG}-snap`,
        timezone: "America/Edmonton",
        snapshot_mode: true,
        ...attestation,
      },
    ])
    .select("id, name, snapshot_mode");
  if (sErr) throw new Error(`fixture sites: ${sErr.message}`);

  const noSnap = sites.find((s) => !s.snapshot_mode).id;
  const snap = sites.find((s) => s.snapshot_mode).id;
  created.sites.push(noSnap, snap);

  const { data: cams, error: cErr } = await db
    .from("cameras")
    .insert([
      { organization_id: org.id, site_id: noSnap, name: `${TAG}-cam-nosnap` },
      { organization_id: org.id, site_id: snap, name: `${TAG}-cam-snap` },
    ])
    .select("id, site_id");
  if (cErr) throw new Error(`fixture cameras: ${cErr.message}`);

  const camNoSnap = cams.find((c) => c.site_id === noSnap).id;
  const camSnap = cams.find((c) => c.site_id === snap).id;
  created.cameras.push(camNoSnap, camSnap);

  return { noSnap, snap, camNoSnap, camSnap };
}

async function teardown() {
  if (created.devices.length) {
    // Violations reference devices; remove them first. This is a test fixture,
    // not production data — the never-delete-a-violation rule (ADR 0003) governs
    // real records, which are tombstoned instead.
    await db.from("violations").delete().in("device_id", created.devices);
    await db.from("devices").delete().in("id", created.devices);
  }
  if (created.cameras.length) {
    await db.from("cameras").delete().in("id", created.cameras);
  }
  if (created.sites.length) {
    await db.from("sites").delete().in("id", created.sites);
  }
  if (created.user) await db.from("users").delete().eq("id", created.user);
  if (created.org) await db.from("organizations").delete().eq("id", created.org);
  await db.from("rate_limit_counters").delete().like("bucket", "ip:203.0.113.%");
  await db.from("rate_limit_counters").delete().like("bucket", "key:%");
}

// ─── the suite ──────────────────────────────────────────────────────

async function run() {
  try {
    await fetch(BASE, { method: "HEAD" });
  } catch {
    console.error(`Cannot reach ${BASE}. Start the dashboard with: npm run dev`);
    process.exit(1);
  }

  const { noSnap, snap, camNoSnap, camSnap } = await setup();

  const devA = await provisionDevice("A-nosnap", noSnap, IP.p1);
  const devB = await provisionDevice("B-snap", snap, IP.p2);
  const devFlood = await provisionDevice("flood", noSnap, IP.p3);

  // ── 1. Happy path ──────────────────────────────────────────────────
  section("1. A device files a violation");

  const first = payload(camNoSnap);
  const r1 = await submit(devA.apiKey, IP.main, first);
  check("returns 201 Created", r1.status === 201, `got ${r1.status} ${JSON.stringify(r1.body)}`);
  check("duplicate is false", r1.body?.duplicate === false);
  check(
    "event_hash is 64 lowercase hex characters (SHA-256)",
    /^[0-9a-f]{64}$/.test(r1.body?.event_hash ?? ""),
    r1.body?.event_hash,
  );
  check("snapshot_enabled reflects the site (off)", r1.body?.snapshot_enabled === false);

  // ── 2. The stored row ──────────────────────────────────────────────
  section("2. What actually landed in the database");

  const { data: row1 } = await db
    .from("violations")
    .select("*")
    .eq("id", r1.body.violation_id)
    .single();

  check("organization_id came from the device, not the request", row1.organization_id === created.org);
  check("site_id came from the device", row1.site_id === noSnap);
  check("device_id is the authenticated device", row1.device_id === devA.id);
  check("camera_id is what was submitted", row1.camera_id === camNoSnap);
  check("violation_type stored", row1.violation_type === "no_hardhat");
  check("idempotency_key stored", row1.idempotency_key === first.idempotency_key);
  check(
    "prev_hash is null — this is the first link in this device's chain",
    row1.prev_hash === null,
  );
  const recvAge = Date.now() - Date.parse(row1.received_at);
  check(
    "received_at was stamped by the server, within the last 20s",
    recvAge >= 0 && recvAge < 20_000,
    `age ${recvAge}ms`,
  );
  check(
    "received_at is distinct from the device-supplied detected_at",
    row1.received_at !== row1.detected_at,
  );
  check("snapshot_s3_key is null (no image path yet)", row1.snapshot_s3_key === null);

  // ── 3. The hash is independently reproducible ──────────────────────
  section("3. The fingerprint can be recomputed from the stored columns");

  const { data: recomputed, error: hashErr } = await db.rpc("allclear_event_hash", {
    p_device_id: row1.device_id,
    p_organization_id: row1.organization_id,
    p_site_id: row1.site_id,
    p_camera_id: row1.camera_id,
    p_violation_type: row1.violation_type,
    p_confidence: row1.confidence,
    p_detected_at: row1.detected_at,
    p_received_at: row1.received_at,
    p_prev_hash: row1.prev_hash,
  });
  check("recompute succeeded", !hashErr, hashErr?.message);
  check(
    "independently recomputed hash equals the stored event_hash",
    recomputed === row1.event_hash,
    `recomputed=${recomputed} stored=${row1.event_hash}`,
  );

  // ── 4. Body smuggling ──────────────────────────────────────────────
  section("4. A body naming another org / site / device is ignored (ADR 0006)");

  const fake = "00000000-0000-0000-0000-0000000000ff";
  const r4 = await submit(devA.apiKey, IP.main, {
    ...payload(camNoSnap),
    organization_id: fake,
    site_id: fake,
    device_id: fake,
    received_at: "1999-01-01T00:00:00.000Z",
    event_hash: "deadbeef",
    prev_hash: "deadbeef",
  });
  check("still returns 201", r4.status === 201, `got ${r4.status}`);

  const { data: row4 } = await db
    .from("violations").select("*").eq("id", r4.body.violation_id).single();
  check("organization_id was NOT taken from the body", row4.organization_id === created.org);
  check("site_id was NOT taken from the body", row4.site_id === noSnap);
  check("device_id was NOT taken from the body", row4.device_id === devA.id);
  check(
    "received_at was NOT taken from the body",
    Date.parse(row4.received_at) > Date.parse("2020-01-01"),
    row4.received_at,
  );
  check("event_hash was NOT taken from the body", row4.event_hash !== "deadbeef");

  // ── 5. Cross-site camera ───────────────────────────────────────────
  section("5. Device A cannot report against another site's camera");

  const crossBody = payload(camSnap); // camSnap belongs to the OTHER site
  const r5 = await submit(devA.apiKey, IP.main, crossBody);
  check("returns 403", r5.status === 403, `got ${r5.status} ${JSON.stringify(r5.body)}`);
  check("the reason is machine-readable", r5.body?.code === "camera_not_at_site", r5.body?.code);

  const { data: leaked } = await db
    .from("violations").select("id").eq("idempotency_key", crossBody.idempotency_key);
  check("no row was created", (leaked ?? []).length === 0);

  // ── 6. Idempotency, sequential ─────────────────────────────────────
  section("6. Re-sending the same event returns the existing row");

  const r6 = await submit(devA.apiKey, IP.main, first);
  check("returns 200, not 201", r6.status === 200, `got ${r6.status}`);
  check("duplicate is true", r6.body?.duplicate === true);
  check("points at the SAME violation", r6.body?.violation_id === r1.body.violation_id);
  check("returns the same event_hash", r6.body?.event_hash === r1.body.event_hash);

  const { data: dupRows } = await db
    .from("violations").select("id").eq("idempotency_key", first.idempotency_key);
  check("exactly one row exists for that key", (dupRows ?? []).length === 1);

  // ── 7. Idempotency, PARALLEL ───────────────────────────────────────
  section("7. Six SIMULTANEOUS identical requests create exactly one row");

  const raceBody = payload(camNoSnap);
  const raced = await Promise.all(
    Array.from({ length: 6 }, () => submit(devA.apiKey, IP.main, raceBody)),
  );

  const codes = raced.map((r) => r.status).sort();
  check(
    "every request got a success status",
    raced.every((r) => r.status === 200 || r.status === 201),
    codes.join(", "),
  );
  check(
    "exactly one was a 201 — one creator, five duplicates",
    raced.filter((r) => r.status === 201).length === 1,
    codes.join(", "),
  );
  const ids = new Set(raced.map((r) => r.body?.violation_id));
  check("all six point at the same violation_id", ids.size === 1, [...ids].join(", "));

  const { data: raceRows } = await db
    .from("violations").select("id").eq("idempotency_key", raceBody.idempotency_key);
  check(
    "exactly ONE row in the database (BUILD_CONTEXT §8)",
    (raceRows ?? []).length === 1,
    `found ${(raceRows ?? []).length}`,
  );

  // ── 8. Chain linearity under concurrency ───────────────────────────
  section("8. Ten SIMULTANEOUS distinct events keep the chain a single line");

  const burst = await Promise.all(
    Array.from({ length: 10 }, () => submit(devA.apiKey, IP.main, payload(camNoSnap))),
  );
  check(
    "all ten were created",
    burst.every((r) => r.status === 201),
    burst.map((r) => r.status).join(", "),
  );

  const chainRows = await rowsFor(devA.id);
  const byPrev = new Map();
  for (const r of chainRows) byPrev.set(r.prev_hash, r);

  const genesis = chainRows.filter((r) => r.prev_hash === null);
  check(
    "exactly one genesis row (prev_hash is null)",
    genesis.length === 1,
    `found ${genesis.length}`,
  );
  check(
    "no two rows claim the same parent — no fork",
    byPrev.size === chainRows.length,
    `${chainRows.length} rows but only ${byPrev.size} distinct parents`,
  );

  // Walk the chain from genesis, following each link forward.
  let cursor = genesis[0];
  let walked = 0;
  const seen = new Set();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    walked++;
    cursor = byPrev.get(cursor.event_hash);
  }
  check(
    "walking the links from genesis visits EVERY row exactly once",
    walked === chainRows.length,
    `walked ${walked} of ${chainRows.length}`,
  );

  const tail = chainRows.find((r) => !byPrev.has(r.event_hash));
  const { data: devRow } = await db
    .from("devices").select("last_event_hash").eq("id", devA.id).single();
  check(
    "the device's cached chain tip matches the last row",
    devRow.last_event_hash === tail.event_hash,
    `tip=${devRow.last_event_hash} tail=${tail.event_hash}`,
  );

  // Re-derive every hash in the chain from its stored columns.
  let allVerified = true;
  let firstBad = null;
  for (const r of chainRows) {
    const { data: h } = await db.rpc("allclear_event_hash", {
      p_device_id: r.device_id,
      p_organization_id: r.organization_id,
      p_site_id: r.site_id,
      p_camera_id: r.camera_id,
      p_violation_type: r.violation_type,
      p_confidence: r.confidence,
      p_detected_at: r.detected_at,
      p_received_at: r.received_at,
      p_prev_hash: r.prev_hash,
    });
    if (h !== r.event_hash) {
      allVerified = false;
      firstBad ??= r.id;
    }
  }
  check(
    `every one of the ${chainRows.length} hashes re-derives correctly`,
    allVerified,
    `first mismatch at ${firstBad}`,
  );

  // ── 9. Snapshot gate ───────────────────────────────────────────────
  section("9. A snapshot offered to a site that did not opt in is refused loudly");

  const snapBody = payload(camNoSnap, { snapshot_requested: true });
  const r9 = await submit(devA.apiKey, IP.snap, snapBody);
  check("returns 400", r9.status === 400, `got ${r9.status}`);
  check("the reason is machine-readable", r9.body?.code === "snapshot_mode_disabled", r9.body?.code);
  check(
    "the message says the violation was NOT recorded, so the device knows to resend",
    /no violation was recorded/i.test(r9.body?.error ?? ""),
    r9.body?.error,
  );
  const { data: snapLeak } = await db
    .from("violations").select("id").eq("idempotency_key", snapBody.idempotency_key);
  check(
    "nothing was silently discarded — and nothing was silently kept either",
    (snapLeak ?? []).length === 0,
  );

  section("9b. The same request to a site that DID opt in succeeds");
  const r9b = await submit(devB.apiKey, IP.snap, payload(camSnap, { snapshot_requested: true }));
  check("returns 201", r9b.status === 201, `got ${r9b.status} ${JSON.stringify(r9b.body)}`);
  check("snapshot_enabled is true", r9b.body?.snapshot_enabled === true);
  const { data: rowB } = await db
    .from("violations").select("snapshot_s3_key").eq("id", r9b.body.violation_id).single();
  check(
    "snapshot_s3_key is still null — the key is set only after the upload is confirmed",
    rowB.snapshot_s3_key === null,
  );

  // ── 10. Shape validation ───────────────────────────────────────────
  section("10. Malformed payloads are rejected before the database is touched");

  const bad = [
    ["detected_at 10 minutes in the future", payload(camNoSnap, {
      detected_at: new Date(Date.now() + 10 * 60_000).toISOString() })],
    ["confidence above 1", payload(camNoSnap, { confidence: 1.5 })],
    ["confidence below 0", payload(camNoSnap, { confidence: -0.2 })],
    ["an unknown violation_type", payload(camNoSnap, { violation_type: "no_helmet" })],
    ["a camera_id that is not a UUID", payload(camNoSnap, { camera_id: "not-a-uuid" })],
  ];
  for (const [label, body] of bad) {
    const r = await submit(devA.apiKey, IP.main, body);
    check(`400 for ${label}`, r.status === 400, `got ${r.status}`);
  }

  const missingKey = payload(camNoSnap);
  delete missingKey.idempotency_key;
  const rMissing = await submit(devA.apiKey, IP.main, missingKey);
  check("400 for a missing idempotency_key", rMissing.status === 400, `got ${rMissing.status}`);

  section("10b. A detection in the PAST is accepted — that is the outage queue replaying");
  const replay = await submit(devA.apiKey, IP.main, payload(camNoSnap, {
    detected_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString() }));
  check("a 6-hour-old detection returns 201", replay.status === 201, `got ${replay.status}`);

  // ── 11. Tamper evidence is enforced, not just computed ─────────────
  section("11. Even the service role cannot edit a sealed column");

  const { error: tamperErr } = await db
    .from("violations")
    .update({ confidence: 0.01 })
    .eq("id", r1.body.violation_id);
  check(
    "the database REFUSES the update (migration 005 trigger)",
    tamperErr !== null,
    "the update was accepted — tamper evidence is not enforced",
  );

  const { data: stillRow } = await db
    .from("violations").select("confidence, event_hash").eq("id", r1.body.violation_id).single();
  check("the stored confidence is unchanged", stillRow.confidence === row1.confidence);
  check("the stored event_hash is unchanged", stillRow.event_hash === row1.event_hash);

  // ── 12. Authentication ─────────────────────────────────────────────
  section("12. Authentication still governs this endpoint");

  const noAuth = await submit(null, IP.main, payload(camNoSnap));
  check("no Authorization header → 401", noAuth.status === 401, `got ${noAuth.status}`);

  await db.from("devices").update({ status: "revoked" }).eq("id", devB.id);
  const revoked = await submit(devB.apiKey, IP.snap, payload(camSnap));
  check("a revoked device → 403", revoked.status === 403, `got ${revoked.status}`);

  // ── 13. Rate limit ─────────────────────────────────────────────────
  section("13. The 61st submission in a minute is refused");

  let refusedAt = null;
  let last = null;
  for (let i = 1; i <= 61; i++) {
    const r = await submit(devFlood.apiKey, IP.flood, payload(camNoSnap));
    last = r;
    if (r.status !== 201) { refusedAt = i; break; }
  }
  check("the first 60 are accepted and the 61st is not", refusedAt === 61, `first refusal at ${refusedAt ?? "never"}`);
  check("the refusal is a 429", last?.status === 429, `got ${last?.status}`);
}

// ─── entry point ────────────────────────────────────────────────────

console.log(`Testing ${URL_VIOLATIONS}`);
try {
  await run();
} catch (err) {
  console.error(`\nSuite aborted: ${err.message}`);
  process.exitCode = 1;
} finally {
  await teardown();
}
finish();
