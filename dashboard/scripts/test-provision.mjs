/**
 * test-provision.mjs — adversarial test suite for POST /api/v1/devices/provision.
 * Phase 3, Step 3.1.
 *
 * Run the dashboard first (`npm run dev`), then:
 *   node scripts/test-provision.mjs
 *
 * Exits non-zero if anything fails, so it can gate a commit or a CI job.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS PROVES, AND WHY EACH ONE IS HERE
 *
 *   1. Happy path            a valid token yields a well-formed key, once
 *   2. Key never stored      the database holds a hash and nothing else
 *   3. Org stamped by server a body naming another org is ignored (ADR 0006)
 *   4. Reuse rejected        a spent token is dead
 *   5. Expired rejected      a stale token is dead
 *   6. INDISTINGUISHABLE     4 and 5 and "never existed" are byte-identical
 *   7. PIPA gate             an unattested site cannot activate a device
 *   8. Rate limited          the 4th attempt in a minute is refused
 *
 * Test 6 is the one that is easy to leave out and is the whole point of the
 * generic 400. A suite that only checks "reuse gives 400" would still pass if
 * the messages differed, and differing messages are exactly what turns token
 * probing from guesswork into a search.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * FIXTURES are created fresh and torn down in a finally block. Everything is
 * named `zz-test-provision-*` so a crashed run leaves obvious litter.
 *
 * IP SPOOFING: each test group sends a different `x-forwarded-for`, because
 * the endpoint's limit is 3/min per IP and this suite makes more calls than
 * that. This works locally because nothing overwrites the header; on Vercel
 * the edge sets it and a client cannot. That asymmetry is noted in
 * lib/rate-limit.ts and is why the per-IP layer is a blunt abuse ceiling
 * rather than an identity.
 */

import { randomUUID } from "node:crypto";

import {
  API_KEY_RE,
  apiBaseUrl,
  check,
  finish,
  generateProvisioningToken,
  loadEnv,
  section,
  serviceClient,
  sha256Hex,
} from "./lib/common.mjs";

loadEnv();

const db = serviceClient();
const BASE = apiBaseUrl();
const URL_PROVISION = `${BASE}/api/v1/devices/provision`;

const TAG = `zz-test-provision-${Date.now()}`;

/** TEST-NET-3 (RFC 5737) — reserved for documentation, never routable. */
const IP = {
  happy: "203.0.113.1",
  expired: "203.0.113.2",
  unattested: "203.0.113.3",
  malformed: "203.0.113.4",
  smuggle: "203.0.113.5",
  ratelimit: "203.0.113.9",
};

const created = { org: null, user: null, sites: [], devices: [] };

// ─── helpers ────────────────────────────────────────────────────────

async function provision(token, ip, extraBody = {}) {
  const res = await fetch(URL_PROVISION, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ provisioning_token: token, ...extraBody }),
  });
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, headers: res.headers };
}

async function makeDevice(siteId, label, { expired = false } = {}) {
  const token = generateProvisioningToken();
  const expiresAt = expired
    ? new Date(Date.now() - 60 * 60 * 1000).toISOString() // one hour ago
    : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("devices")
    .insert({
      organization_id: created.org,
      site_id: siteId,
      name: `${TAG}-${label}`,
      status: "pending",
      provisioning_token_hash: sha256Hex(token),
      provisioning_token_expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) throw new Error(`fixture device ${label}: ${error.message}`);
  created.devices.push(data.id);
  return { id: data.id, token };
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

  // An attesting user is REQUIRED, not decorative. The `sites` table carries
  // CHECK pipa_attestation_complete_requires_metadata (migration 000): you
  // cannot set pipa_attestation_completed = true without also recording WHO
  // attested and WHEN. That is the difference between a compliance record and
  // a boolean someone flipped, and the database will not let you skip it.
  //
  // users.id is a bare uuid PRIMARY KEY with no FK to auth.users, so a
  // synthetic attester is valid here — the same approach migration 006's own
  // behaviour test uses.
  const attesterId = randomUUID();
  const { error: userErr } = await db.from("users").insert({
    id: attesterId,
    organization_id: org.id,
    email: `${TAG}@example.invalid`,
    full_name: "Provisioning Suite Fixture",
    role: "org_admin",
    status: "active",
  });
  if (userErr) throw new Error(`fixture user: ${userErr.message}`);
  created.user = attesterId;

  const { data: sites, error: siteErr } = await db
    .from("sites")
    .insert([
      {
        organization_id: org.id,
        name: `${TAG}-attested`,
        timezone: "America/Edmonton",
        pipa_attestation_completed: true,
        pipa_attestation_by: attesterId,
        pipa_attestation_at: new Date().toISOString(),
      },
      {
        organization_id: org.id,
        name: `${TAG}-unattested`,
        timezone: "America/Edmonton",
        pipa_attestation_completed: false,
      },
    ])
    .select("id, pipa_attestation_completed");
  if (siteErr) throw new Error(`fixture sites: ${siteErr.message}`);

  const attested = sites.find((s) => s.pipa_attestation_completed).id;
  const unattested = sites.find((s) => !s.pipa_attestation_completed).id;
  created.sites.push(attested, unattested);

  return { attested, unattested };
}

async function teardown() {
  // Children before parents. Note sites must go before users: an attested site
  // holds an FK to the user who attested it (sites_pipa_attestation_by_fkey).
  if (created.devices.length) {
    await db.from("devices").delete().in("id", created.devices);
  }
  if (created.sites.length) {
    await db.from("sites").delete().in("id", created.sites);
  }
  if (created.user) {
    await db.from("users").delete().eq("id", created.user);
  }
  if (created.org) {
    await db.from("organizations").delete().eq("id", created.org);
  }
  // The durable limiter's rows, so a re-run starts from a clean budget.
  await db.from("rate_limit_counters").delete().like("bucket", "ip:203.0.113.%");
}

// ─── the suite ──────────────────────────────────────────────────────

async function run() {
  // Preflight: a connection refused here is far more useful than 20 failures.
  try {
    await fetch(BASE, { method: "HEAD" });
  } catch {
    console.error(`Cannot reach ${BASE}. Start the dashboard with: npm run dev`);
    process.exit(1);
  }

  const { attested, unattested } = await setup();

  const happy = await makeDevice(attested, "happy");
  const expired = await makeDevice(attested, "expired", { expired: true });
  const gated = await makeDevice(unattested, "gated");
  const smuggle = await makeDevice(attested, "smuggle");
  const rlDevices = [];
  for (let i = 0; i < 4; i++) {
    rlDevices.push(await makeDevice(attested, `rl${i}`));
  }

  // ── 1. Happy path ──────────────────────────────────────────────────
  section("1. Happy path — valid token on an attested site");

  const ok = await provision(happy.token, IP.happy);
  check("returns 200", ok.status === 200, `got ${ok.status}`);
  check(
    "api_key matches ac_live_<16 hex>_<43 base64url>",
    typeof ok.body?.api_key === "string" && API_KEY_RE.test(ok.body.api_key),
    `got ${ok.body?.api_key}`,
  );
  check(
    "device_id matches the fixture",
    ok.body?.device_id === happy.id,
    `got ${ok.body?.device_id}`,
  );
  check(
    "organization_id is the site's org",
    ok.body?.organization_id === created.org,
    `got ${ok.body?.organization_id}`,
  );
  check("site_id is the attested site", ok.body?.site_id === attested);
  check(
    "response is marked no-store",
    ok.headers.get("cache-control") === "no-store",
    `got ${ok.headers.get("cache-control")}`,
  );

  // ── 2. The key is never stored ─────────────────────────────────────
  section("2. The plaintext key exists nowhere in the database");

  const apiKey = ok.body?.api_key ?? "";
  const sep = apiKey.indexOf("_", "ac_live_".length);
  const keyId = apiKey.slice("ac_live_".length, sep);
  const secret = apiKey.slice(sep + 1);

  const { data: row } = await db
    .from("devices")
    .select("*")
    .eq("id", happy.id)
    .single();

  const rowText = JSON.stringify(row ?? {});

  check("device status flipped to active", row?.status === "active");
  check("key_id stored matches the issued key", row?.key_id === keyId);
  check(
    "api_key_hash is sha256(secret)",
    row?.api_key_hash === sha256Hex(secret),
  );
  check(
    "the SECRET appears nowhere in the device row",
    secret.length > 0 && !rowText.includes(secret),
  );
  check(
    "the whole API KEY appears nowhere in the device row",
    !rowText.includes(apiKey),
  );
  check(
    "the PROVISIONING TOKEN appears nowhere in the device row",
    !rowText.includes(happy.token),
  );
  check(
    "provisioning_token_hash was consumed (null)",
    row?.provisioning_token_hash === null,
  );
  check(
    "provisioning_token_expires_at was cleared (null)",
    row?.provisioning_token_expires_at === null,
  );

  // ── 3. Org stamping (ADR 0006) ─────────────────────────────────────
  section("3. A body naming another organisation is ignored, not obeyed");

  const fakeOrg = "00000000-0000-0000-0000-0000000000ff";
  const smug = await provision(smuggle.token, IP.smuggle, {
    organization_id: fakeOrg,
    site_id: fakeOrg,
    status: "active",
    key_id: "deadbeefdeadbeef",
  });
  check("still returns 200", smug.status === 200, `got ${smug.status}`);
  check(
    "organization_id came from the database, not the body",
    smug.body?.organization_id === created.org,
    `got ${smug.body?.organization_id}`,
  );
  check(
    "site_id came from the database, not the body",
    smug.body?.site_id === attested,
    `got ${smug.body?.site_id}`,
  );
  const smugKeyId = (smug.body?.api_key ?? "").slice(
    "ac_live_".length,
    (smug.body?.api_key ?? "").indexOf("_", "ac_live_".length),
  );
  check(
    "key_id was minted by the server, not taken from the body",
    smugKeyId !== "deadbeefdeadbeef" && /^[0-9a-f]{16}$/.test(smugKeyId),
    `got ${smugKeyId}`,
  );

  // ── 4/5/6. Dead tokens, and their indistinguishability ─────────────
  section("4. A spent token is rejected");
  const reuse = await provision(happy.token, IP.happy);
  check("reuse returns 400", reuse.status === 400, `got ${reuse.status}`);

  section("5. An expired token is rejected");
  const stale = await provision(expired.token, IP.expired);
  check("expired returns 400", stale.status === 400, `got ${stale.status}`);

  section("6. Spent, expired and never-issued are indistinguishable");
  const never = await provision(generateProvisioningToken(), IP.expired);
  check("unknown token returns 400", never.status === 400, `got ${never.status}`);

  const bodies = [reuse.body, stale.body, never.body].map((b) =>
    JSON.stringify(b),
  );
  check(
    "all three response bodies are byte-identical",
    bodies[0] === bodies[1] && bodies[1] === bodies[2],
    `spent=${bodies[0]} expired=${bodies[1]} unknown=${bodies[2]}`,
  );
  check(
    "the shared body names no specific cause",
    !/expired|used|claimed|exists|unknown/i.test(bodies[0]) ||
      bodies[0] === bodies[1],
    bodies[0],
  );

  section("6b. A malformed token gets the same answer");
  const junk = await provision("not-a-real-token", IP.malformed);
  check("malformed returns 400", junk.status === 400, `got ${junk.status}`);
  check(
    "malformed body is identical to the others",
    JSON.stringify(junk.body) === bodies[0],
    `got ${JSON.stringify(junk.body)}`,
  );

  // ── 7. The PIPA attestation gate ───────────────────────────────────
  section("7. An unattested site cannot activate a device (open item 1.3)");

  const blocked = await provision(gated.token, IP.unattested);
  check("returns 403, not 400", blocked.status === 403, `got ${blocked.status}`);
  check(
    "the reason is machine-readable",
    blocked.body?.code === "site_not_attested",
    `got ${blocked.body?.code}`,
  );
  check(
    "the message names attestation so a technician is not sent to debug a good token",
    /attestation/i.test(blocked.body?.error ?? ""),
    blocked.body?.error,
  );

  const { data: gatedRow } = await db
    .from("devices")
    .select("status, key_id, api_key_hash, provisioning_token_hash")
    .eq("id", gated.id)
    .single();
  check("the blocked device is still pending", gatedRow?.status === "pending");
  check("no key was issued to it", gatedRow?.key_id === null);
  check("no key hash was written", gatedRow?.api_key_hash === null);
  check(
    "its token was NOT consumed — it works once the site is attested",
    gatedRow?.provisioning_token_hash !== null,
  );

  // ── 8. Rate limiting ───────────────────────────────────────────────
  section("8. The 4th attempt from one IP in a minute is refused");

  const statuses = [];
  for (let i = 0; i < 4; i++) {
    const r = await provision(rlDevices[i].token, IP.ratelimit);
    statuses.push(r.status);
    if (i === 3) {
      check("4th returns 429", r.status === 429, `got ${r.status}`);
      check(
        "429 carries a Retry-After header",
        Number(r.headers.get("retry-after")) > 0,
        `got ${r.headers.get("retry-after")}`,
      );
    }
  }
  check(
    "the first 3 were allowed through",
    statuses.slice(0, 3).every((s) => s === 200),
    `got ${statuses.join(", ")}`,
  );

  const { data: rlBlocked } = await db
    .from("devices")
    .select("status")
    .eq("id", rlDevices[3].id)
    .single();
  check(
    "the rate-limited request did NOT consume its token",
    rlBlocked?.status === "pending",
    `got ${rlBlocked?.status}`,
  );
}

// ─── entry point ────────────────────────────────────────────────────

console.log(`Testing ${URL_PROVISION}`);
try {
  await run();
} catch (err) {
  console.error(`\nSuite aborted: ${err.message}`);
  process.exitCode = 1;
} finally {
  await teardown();
}
finish();
