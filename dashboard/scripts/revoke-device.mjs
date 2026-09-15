/**
 * revoke-device.mjs — turn a device off, and turn it back on.
 *
 * WHY THIS EXISTS
 * ---------------
 * Revocation was ENFORCED but not OPERABLE. `lib/device-auth.ts` has always
 * rejected a device whose `status` is not `active`, and the heartbeat test
 * proves it returns 403. But nothing an operator could reach ever *wrote*
 * `status = 'revoked'` — every write of that value in the entire codebase was
 * inside a test script. Revoking a stolen device meant opening the Supabase SQL
 * editor and writing an UPDATE by hand, against production, under time
 * pressure, which is when people make the mistake that takes a site offline.
 *
 * A control that is implemented but not reachable is not a control. This is the
 * reachable half.
 *
 * Usage:
 *   node scripts/revoke-device.mjs --list
 *   node scripts/revoke-device.mjs --device <uuid> --reason "laptop stolen"
 *   node scripts/revoke-device.mjs --device <uuid> --reason "..." --confirm
 *   node scripts/revoke-device.mjs --device <uuid> --restore --confirm
 *
 * SAFETY PROPERTIES, each one deliberate:
 *   1. Dry run by default. Nothing is written without --confirm. The dry run
 *      prints the exact row that would change.
 *   2. A reason is required to revoke. It goes in the audit log, not in
 *      somebody's memory of a Tuesday.
 *   3. It refuses to act on more than one device at a time.
 *   4. --restore sets status back to 'active'. Recovering from a fat-fingered
 *      revocation should not require the SQL editor either -- that is the
 *      failure mode this script exists to remove, and it applies to its own
 *      mistakes.
 *
 * It does NOT rotate the key. A revoked device keeps its `api_key_hash`, so
 * restoring it restores the same credential. If the key is believed stolen,
 * revoke here and then issue a new device with create-device.mjs; key rotation
 * in place does not exist (see the "not built" list in the system docs).
 */

import { pathToFileURL } from "node:url";
import { loadEnv, serviceClient } from "./lib/common.mjs";

/**
 * The database client is created lazily, inside the CLI entry point, NOT at
 * module scope. Two reasons, and the second was found by the guard test:
 *   1. `serviceClient()` needs the service-role key, so importing this file to
 *      reuse `planAction` would demand credentials it does not need.
 *   2. Anything at module scope runs on import. The first version called
 *      `process.exit(2)` at import time, so `import { planAction }` killed the
 *      importing process before it ran a single assertion.
 */
let db = null;
function database() {
  if (!db) {
    loadEnv();
    db = serviceClient();
  }
  return db;
}

/** Parse argv into a plain object. Exported for the offline test. */
export function parseArgs(argv) {
  const out = { list: false, device: null, reason: null, confirm: false, restore: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") out.list = true;
    else if (a === "--confirm") out.confirm = true;
    else if (a === "--restore") out.restore = true;
    else if (a === "--device") out.device = argv[++i] ?? null;
    else if (a === "--reason") out.reason = argv[++i] ?? null;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

/**
 * Decide what the arguments mean, with no database and no side effects.
 * Returns {ok:true, action, ...} or {ok:false, error}. Separated from the IO so
 * the guard rules are testable without credentials -- the guards are the part
 * that has to be right.
 */
export function planAction(args) {
  if (args.list) return { ok: true, action: "list" };

  if (!args.device) {
    return { ok: false, error: "--device <uuid> is required (or --list to see them)" };
  }
  // Loose UUID shape check. The database is the real authority; this only
  // catches a pasted device NAME, which is the realistic mistake.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.device)) {
    return { ok: false, error: `--device must be a uuid, got ${JSON.stringify(args.device)}` };
  }

  if (args.restore) {
    if (args.reason) {
      return { ok: false, error: "--reason applies to revocation, not --restore" };
    }
    return { ok: true, action: "restore", device: args.device, confirm: args.confirm };
  }

  if (!args.reason || !args.reason.trim()) {
    return { ok: false, error: "--reason is required to revoke, and is recorded in the audit log" };
  }
  return {
    ok: true,
    action: "revoke",
    device: args.device,
    reason: args.reason.trim(),
    confirm: args.confirm,
  };
}

async function listDevices() {
  const { data, error } = await database()
    .from("devices")
    .select("id, name, status, site_id, last_seen_at")
    .order("status", { ascending: true });
  if (error) throw error;
  if (!data.length) return console.log("no devices");
  for (const d of data) {
    console.log(
      `${d.status.padEnd(9)} ${d.id}  ${String(d.name ?? "").padEnd(24)} last seen ${d.last_seen_at ?? "never"}`,
    );
  }
}

async function setStatus(plan) {
  const next = plan.action === "revoke" ? "revoked" : "active";

  const { data: before, error: readErr } = await database()
    .from("devices")
    .select("id, name, status, organization_id, site_id")
    .eq("id", plan.device)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!before) {
    console.error(`no device with id ${plan.device}`);
    process.exit(1);
  }

  console.log(`device   ${before.id}  ${before.name ?? ""}`);
  console.log(`status   ${before.status}  ->  ${next}`);
  if (plan.reason) console.log(`reason   ${plan.reason}`);

  if (before.status === next) {
    console.log(`\nalready ${next}. Nothing to do.`);
    return;
  }

  if (!plan.confirm) {
    console.log("\nDRY RUN. Nothing was written. Re-run with --confirm to apply.");
    return;
  }

  const { error: writeErr } = await database()
    .from("devices")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", plan.device);
  if (writeErr) throw writeErr;

  // Best effort, and deliberately not fatal: the status change is the control,
  // the audit row is the paperwork. Failing the revocation because the log
  // insert failed would leave a stolen device active.
  const { error: auditErr } = await database().from("audit_log").insert({
    organization_id: before.organization_id,
    action: plan.action === "revoke" ? "device.revoked" : "device.restored",
    // target_type / target_id, NOT resource_*. Verified against
    // 20260703000900_schema_v2.sql:97-106; target_type is NOT NULL.
    target_type: "device",
    target_id: before.id,
    metadata: { reason: plan.reason ?? null, from: before.status, to: next, via: "revoke-device.mjs" },
  });
  if (auditErr) console.error(`WARNING: status changed, audit_log insert failed: ${auditErr.message}`);

  console.log(`\nDONE. Device is now ${next}.`);
  if (next === "revoked") {
    console.log("Its next request gets HTTP 403. Existing requests in flight are not cancelled.");
  }
}

// Only run the CLI when this file is the entry point. Importing it (the guard
// test does) must have no side effects at all.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let plan;
  try {
    plan = planAction(parseArgs(process.argv.slice(2)));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (!plan.ok) {
    console.error(plan.error);
    process.exit(2);
  }
  if (plan.action === "list") await listDevices();
  else await setStatus(plan);
}
