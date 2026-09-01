/**
 * test-heartbeat.mjs — adversarial test suite for POST /api/v1/devices/heartbeat.
 * Phase 3, Step 3.2.
 *
 * Run the dashboard first (`npm run dev`), then:
 *   node scripts/test-heartbeat.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS IS THE FIRST SUITE THAT USES A REAL ISSUED KEY.
 *
 * It does not fabricate credentials. It creates devices, provisions each one
 * through the actual /provision endpoint, and then authenticates with the key
 * that endpoint returned. So it tests the join between commit 4 and commit 5,
 * not just this endpoint in isolation — if provisioning issued a key the
 * authenticator cannot read, this suite fails at test 1.
 *
 * WHAT IT PROVES
 *
 *   1. A provisioned key authenticates, and last_seen_at moves
 *   2. Five different auth failures are ONE indistinguishable 401
 *   3. Revocation actually revokes  (the FAIL condition in the plan)
 *   4. A wrong secret cannot burn a real device's rate-limit budget
 *   5. The body is validated, and everything but `status` is discarded
 *   6. The 121st call in a minute is refused
 *
 * Test 4 is the one that would be easy to omit and is the reason the per-key
 * limit is applied AFTER authentication rather than before. See the ordering
 * note at the top of the route.
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
const URL_HEARTBEAT = `${BASE}/api/v1/devices/heartbeat`;
const URL_PROVISION = `${BASE}/api/v1/devices/provision`;

const TAG = `zz-test-heartbeat-${Date.now()}`;

/** TEST-NET-3 (RFC 5737). .2x provisions, .1x heartbeats — separate budgets. */
const IP = {
  provisionA: "203.0.113.21",
  provisionB: "203.0.113.22",
  provisionC: "203.0.113.23",
  happy: "203.0.113.11",
  authfail: "203.0.113.12",
  revoked: "203.0.113.13",
  budget: "203.0.113.14",
  body: "203.0.113.15",
  ratelimit: "203.0.113.16",
};

const created = { org: null, user: null, site: null, devices: [] };

// ─── helpers ────────────────────────────────────────────────────────

async function heartbeat(apiKey, ip, body = { status: "online" }) {
  const headers = { "Content-Type": "application/json", "x-forwarded-for": ip };
  if (apiKey !== null) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(URL_HEARTBEAT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  let parsed;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed, headers: res.headers };
}

/**
 * Create a device row and activate it through the real provisioning endpoint.
 * Returns the API key that endpoint issued — the same string a real Jetson
 * would hold.
 */
async function provisionDevice(label, ip) {
  const token = generateProvisioningToken();

  const { data, error } = await db
    .from("devices")
    .insert({
      organization_id: created.org,
      site_id: created.site,
      name: `${TAG}-${label}`,
      status: "pending",
      provisioning_token_hash: sha256Hex(token),
      provisioning_token_expires_at: new Date(
        Date.now() + 48 * 60 * 60 * 1000,
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
  const payload = await res.json();
  if (res.status !== 200 || !payload.api_key) {
    throw new Error(
      `provisioning ${label} failed: ${res.status} ${JSON.stringify(payload)}`,
    );
  }

  return { id: data.id, apiKey: payload.api_key, ...splitApiKey(payload.api_key) };
}

/** Total requests recorded against a durable rate-limit bucket. */
async function bucketCount(bucket) {
  const { data } = await db
    .from("rate_limit_counters")
    .select("request_count")
    .eq("bucket", bucket);
  return (data ?? []).reduce((sum, r) => sum + r.request_count, 0);
}

async function deviceRow(id) {
  const { data } = await db.from("devices").select("*").eq("id", id).single();
  return data;
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

  // Required by CHECK pipa_attestation_complete_requires_metadata: a site
  // cannot be marked attested without recording who attested and when.
  const attesterId = randomUUID();
  const { error: userErr } = await db.from("users").insert({
    id: attesterId,
    organization_id: org.id,
    email: `${TAG}@example.invalid`,
    full_name: "Heartbeat Suite Fixture",
    role: "org_admin",
    status: "active",
  });
  if (userErr) throw new Error(`fixture user: ${userErr.message}`);
  created.user = attesterId;

  const { data: site, error: siteErr } = await db
    .from("sites")
    .insert({
      organization_id: org.id,
      name: `${TAG}-site`,
      timezone: "America/Edmonton",
      pipa_attestation_completed: true,
      pipa_attestation_by: attesterId,
      pipa_attestation_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (siteErr) throw new Error(`fixture site: ${siteErr.message}`);
  created.site = site.id;
}

async function teardown() {
  if (created.devices.length) {
    await db.from("devices").delete().in("id", created.devices);
  }
  if (created.site) await db.from("sites").delete().eq("id", created.site);
  if (created.user) await db.from("users").delete().eq("id", created.user);
  if (created.org) await db.from("organizations").delete().eq("id", created.org);
  await db.from("rate_limit_counters").delete().like("bucket", "ip:203.0.113.%");
  await db.from("rate_limit_counters").delete().like("bucket", `key:%:heartbeat`);
}

// ─── the suite ──────────────────────────────────────────────────────

async function run() {
  try {
    await fetch(BASE, { method: "HEAD" });
  } catch {
    console.error(`Cannot reach ${BASE}. Start the dashboard with: npm run dev`);
    process.exit(1);
  }

  await setup();

  const alive = await provisionDevice("alive", IP.provisionA);
  const dead = await provisionDevice("revoked", IP.provisionB);
  const flood = await provisionDevice("flood", IP.provisionC);

  // ── 1. A provisioned key actually works ────────────────────────────
  section("1. A key issued by /provision authenticates here");

  const before = await deviceRow(alive.id);
  check(
    "last_seen_at starts null (provisioning does not set it)",
    before?.last_seen_at === null,
    `got ${before?.last_seen_at}`,
  );

  const beat = await heartbeat(alive.apiKey, IP.happy);
  check("returns 200", beat.status === 200, `got ${beat.status}`);
  check(
    "body is exactly { status: 'ok' }",
    JSON.stringify(beat.body) === JSON.stringify({ status: "ok" }),
    JSON.stringify(beat.body),
  );
  check(
    "response is marked no-store",
    beat.headers.get("cache-control") === "no-store",
  );

  const after = await deviceRow(alive.id);
  const age = Date.now() - Date.parse(after?.last_seen_at ?? 0);
  check("last_seen_at is now set", after?.last_seen_at !== null);
  check(
    "last_seen_at is within the last 15 seconds",
    age >= 0 && age < 15_000,
    `age ${age}ms`,
  );
  check(
    "device is still active (heartbeat changed nothing else)",
    after?.status === "active" && after?.key_id === alive.keyId,
  );

  // ── 2. Five auth failures, one answer ──────────────────────────────
  section("2. Every authentication failure is the same 401");

  const noHeader = await heartbeat(null, IP.authfail);
  const garbage = await heartbeat("total-garbage", IP.authfail);
  const wrongShape = await heartbeat("ac_live_zzz_short", IP.authfail);
  const unknownId = await heartbeat(
    `ac_live_${"a1b2c3d4e5f60718"}_${"x".repeat(43)}`,
    IP.authfail,
  );
  // The dangerous one: a REAL key_id belonging to a REAL active device, with a
  // secret that is the right shape and wrong. This must be indistinguishable
  // from a key_id that never existed, or 401-vs-something-else becomes a way to
  // enumerate which devices are real.
  const wrongSecret = await heartbeat(
    `ac_live_${alive.keyId}_${"y".repeat(43)}`,
    IP.authfail,
  );

  const all = [noHeader, garbage, wrongShape, unknownId, wrongSecret];
  check(
    "all five return 401",
    all.every((r) => r.status === 401),
    all.map((r) => r.status).join(", "),
  );
  const bodies = all.map((r) => JSON.stringify(r.body));
  check(
    "all five bodies are byte-identical",
    bodies.every((b) => b === bodies[0]),
    bodies.join(" | "),
  );
  check(
    "a real key_id with a wrong secret is indistinguishable from an unknown one",
    bodies[4] === bodies[3],
    `real=${bodies[4]} unknown=${bodies[3]}`,
  );

  // ── 3. Revocation ──────────────────────────────────────────────────
  section("3. Revocation actually revokes");

  const preRevoke = await heartbeat(dead.apiKey, IP.revoked);
  check(
    "the key works before revocation",
    preRevoke.status === 200,
    `got ${preRevoke.status}`,
  );

  // Snapshot the timestamp the working heartbeat just wrote, so we can prove
  // the post-revocation attempt does not write a new one.
  const seenWhileActive = (await deviceRow(dead.id)).last_seen_at;

  await db.from("devices").update({ status: "revoked" }).eq("id", dead.id);

  const postRevoke = await heartbeat(dead.apiKey, IP.revoked);
  check(
    "returns 403, NOT 200 (the plan's explicit FAIL condition)",
    postRevoke.status === 403,
    `got ${postRevoke.status}`,
  );
  check(
    "the 403 body differs from the 401 body",
    JSON.stringify(postRevoke.body) !== bodies[0],
    JSON.stringify(postRevoke.body),
  );
  check(
    "the message tells the operator to contact an administrator",
    /administrator/i.test(postRevoke.body?.error ?? ""),
    postRevoke.body?.error,
  );

  // The point of the check: rejection must happen BEFORE any write. If the
  // route updated last_seen_at and then checked status, a revoked device would
  // still be quietly touching the database on every beat, and the dashboard
  // would show it as recently seen.
  const revokedRow = await deviceRow(dead.id);
  check(
    "a revoked device's last_seen_at does not move",
    revokedRow.last_seen_at === seenWhileActive,
    `was ${seenWhileActive}, now ${revokedRow.last_seen_at}`,
  );

  // ── 4. A wrong secret cannot spend a real device's budget ──────────
  section("4. Failed auth does not burn the victim's rate-limit budget");

  const victimBucket = `key:${alive.keyId}:heartbeat`;
  const budgetBefore = await bucketCount(victimBucket);

  for (let i = 0; i < 8; i++) {
    await heartbeat(`ac_live_${alive.keyId}_${"z".repeat(43)}`, IP.budget);
  }

  const budgetAfter = await bucketCount(victimBucket);
  check(
    "8 wrong-secret attempts consumed 0 of the victim's 120/min",
    budgetAfter === budgetBefore,
    `before=${budgetBefore} after=${budgetAfter}`,
  );

  const stillWorks = await heartbeat(alive.apiKey, IP.happy);
  check(
    "the real device still gets 200 afterwards",
    stillWorks.status === 200,
    `got ${stillWorks.status}`,
  );
  check(
    "and a genuine call DID consume budget",
    (await bucketCount(victimBucket)) === budgetBefore + 1,
  );

  // ── 5. Body validation ─────────────────────────────────────────────
  section("5. The body is checked, and all of it but `status` is discarded");

  const badStatus = await heartbeat(alive.apiKey, IP.body, { status: "vibing" });
  check("an invalid status is rejected", badStatus.status === 400);
  check(
    "the 400 names the offending field (caller is authenticated, so detail is safe)",
    badStatus.body?.details?.status !== undefined,
    JSON.stringify(badStatus.body),
  );

  const emptyBody = await heartbeat(alive.apiKey, IP.body, {});
  check("a missing status is rejected", emptyBody.status === 400);

  const rich = await heartbeat(alive.apiKey, IP.body, {
    status: "degraded",
    cpu_temp: 71.5,
    uptime_seconds: 98123,
    model_version: "ppe_v1",
  });
  check("the documented optional fields are accepted", rich.status === 200);

  const richRow = await deviceRow(alive.id);
  const rowText = JSON.stringify(richRow);
  check(
    "none of them are stored anywhere on the device row",
    !rowText.includes("71.5") &&
      !rowText.includes("98123") &&
      !rowText.includes("ppe_v1"),
  );
  check(
    "the reported status is discarded too — 'degraded' does not change device status",
    richRow.status === "active",
    `got ${richRow.status}`,
  );

  // ── 6. The per-key rate limit ──────────────────────────────────────
  section("6. The 121st call in one minute is refused");

  let firstRefusalAt = null;
  let lastResponse = null;
  for (let i = 1; i <= 121; i++) {
    const r = await heartbeat(flood.apiKey, IP.ratelimit);
    lastResponse = r;
    if (r.status !== 200 && firstRefusalAt === null) {
      firstRefusalAt = i;
      break;
    }
  }
  check(
    "the first 120 are allowed and the 121st is not",
    firstRefusalAt === 121,
    `first refusal at request ${firstRefusalAt ?? "never"}`,
  );
  check("the refusal is a 429", lastResponse?.status === 429);
  check(
    "the 429 carries a Retry-After",
    Number(lastResponse?.headers.get("retry-after")) > 0,
    `got ${lastResponse?.headers.get("retry-after")}`,
  );
}

// ─── entry point ────────────────────────────────────────────────────

console.log(`Testing ${URL_HEARTBEAT}`);
try {
  await run();
} catch (err) {
  console.error(`\nSuite aborted: ${err.message}`);
  process.exitCode = 1;
} finally {
  await teardown();
}
finish();
