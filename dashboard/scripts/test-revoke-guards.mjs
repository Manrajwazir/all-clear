/**
 * test-revoke-guards.mjs — the argument guards on revoke-device.mjs.
 *
 * SCOPE, STATED HONESTLY. This tests `parseArgs` and `planAction`, which are
 * pure and need no credentials. It does NOT test that a revoked device is
 * actually refused by the API -- `test-heartbeat.mjs` already covers that, and
 * it needs a live database.
 *
 * The guards are worth their own suite because they are the part that decides
 * whether a tired person at 11pm revokes the right device. A wrong UPDATE here
 * takes a real site offline.
 *
 * Run:  node scripts/test-revoke-guards.mjs
 */

import { parseArgs, planAction } from "./revoke-device.mjs";

const UUID = "0f8e1d2c-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

/** plan() from a raw argv array, never throwing. */
function plan(...argv) {
  try {
    return planAction(parseArgs(argv));
  } catch (e) {
    return { ok: false, error: e.message, threw: true };
  }
}

console.log("revoke-device argument guards");
console.log("=".repeat(68));

// ── refuses ambiguous or dangerous input ─────────────────────────────────
check("no arguments at all is refused", plan().ok === false);
check("--device without a uuid is refused", plan("--device").ok === false);
check("a device NAME instead of a uuid is refused",
  plan("--device", "Trailer Pi 01", "--reason", "x").ok === false);
check("--device swallowing the next flag is refused",
  plan("--device", "--reason", "stolen").ok === false);
check("revoking with no reason is refused",
  plan("--device", UUID).ok === false);
check("revoking with a blank reason is refused",
  plan("--device", UUID, "--reason", "   ").ok === false);
check("--reason on a --restore is refused as a likely mistake",
  plan("--device", UUID, "--restore", "--reason", "oops").ok === false);
check("an unknown flag is refused rather than ignored",
  plan("--device", UUID, "--force").ok === false);

// ── accepts the real cases ───────────────────────────────────────────────
const p1 = plan("--device", UUID, "--reason", "laptop stolen");
check("a well-formed revoke is accepted", p1.ok && p1.action === "revoke");
check("the reason is trimmed and carried",
  plan("--device", UUID, "--reason", "  stolen  ").reason === "stolen");
check("--list needs nothing else", plan("--list").ok && plan("--list").action === "list");
check("--restore is accepted", plan("--device", UUID, "--restore").action === "restore");
check("an uppercase uuid is accepted",
  plan("--device", UUID.toUpperCase(), "--reason", "x").ok);

// ── THE important one: writes must not happen by default ─────────────────
check("a revoke WITHOUT --confirm is a dry run",
  plan("--device", UUID, "--reason", "x").confirm === false);
check("a restore WITHOUT --confirm is a dry run",
  plan("--device", UUID, "--restore").confirm === false);
check("--confirm is what arms the write",
  plan("--device", UUID, "--reason", "x", "--confirm").confirm === true);

console.log("=".repeat(68));
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
