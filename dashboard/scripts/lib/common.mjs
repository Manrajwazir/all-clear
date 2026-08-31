/**
 * Shared helpers for the operator and test scripts in this folder.
 * Phase 3, Step 3.1.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ THIS FILE MIRRORS lib/device-key-format.ts. KEEP THEM IN STEP.
 *
 * These scripts are plain `.mjs` so they run under `node` with no build step
 * and no TypeScript loader, which means they cannot import the app's `.ts`
 * modules. The crypto below is therefore duplicated from
 * `lib/device-key-format.ts`.
 *
 * That duplication is a real risk and it is taken with eyes open, because the
 * failure mode is LOUD, not silent: if these two ever disagree about how a
 * token is hashed, every provisioning attempt fails immediately with "invalid
 * token" the first time anyone tries. Nothing is quietly accepted, no bad data
 * is written, and no key is issued. Compare that to the class of bug where two
 * hash implementations drift and half the rows become unverifiable — that
 * cannot happen here, because this file only ever produces values the server
 * must independently agree with in the very next request.
 *
 * If you change `sha256Hex` or the token/key shape in the TS file, change it
 * here in the same commit.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
/** scripts/lib → scripts → dashboard */
const DASHBOARD_ROOT = resolve(HERE, "..", "..");

// ─── Environment ────────────────────────────────────────────────────

/**
 * Load `dashboard/.env.local` into process.env.
 *
 * Hand-rolled rather than `--env-file` (Node >= 20.6 only) or dotenv (a
 * dependency added for two scripts). Existing process.env values win, so
 * `SUPABASE_URL=... node scripts/...` still overrides the file.
 */
export function loadEnv() {
  const path = resolve(DASHBOARD_ROOT, ".env.local");

  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    console.error(`Could not read ${path}`);
    console.error("Copy .env.local.example to .env.local and fill it in.");
    process.exit(1);
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    // Tolerate quoted values; .env files in the wild have both forms.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** Read a required variable or exit with a message naming it. */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in dashboard/.env.local`);
    process.exit(1);
  }
  return value;
}

/**
 * A Supabase client using the SERVICE ROLE key.
 *
 * Bypasses RLS entirely. Only ever run these scripts against a database you
 * intend to write to, and never paste the key they read into a shared channel.
 */
export function serviceClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Base URL of the running dashboard. Override with ALLCLEAR_API_URL. */
export function apiBaseUrl() {
  return process.env.ALLCLEAR_API_URL ?? "http://localhost:3000";
}

// ─── Key format — MIRRORS lib/device-key-format.ts ──────────────────

export const KEY_PREFIX = "ac_live_";

/** Exact shape of an issued key: prefix + 16 hex + "_" + 43 base64url chars. */
export const API_KEY_RE = /^ac_live_[0-9a-f]{16}_[A-Za-z0-9_-]{43}$/;

/** SHA-256 of a UTF-8 string, lowercase hex. Mirrors sha256Hex(). */
export function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** 32 random bytes, base64url. Mirrors generateProvisioningToken(). */
export function generateProvisioningToken() {
  return randomBytes(32).toString("base64url");
}

// ─── Test output ────────────────────────────────────────────────────

const results = { pass: 0, fail: 0 };

/** Record and print one assertion. `detail` is shown only on failure. */
export function check(name, ok, detail) {
  if (ok) {
    results.pass++;
    console.log(`  PASS  ${name}`);
  } else {
    results.fail++;
    console.log(`  FAIL  ${name}`);
    if (detail !== undefined) console.log(`        ${detail}`);
  }
  return ok;
}

export function section(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(Math.max(title.length, 40)));
}

/**
 * Print the tally and exit non-zero if anything failed, so CI can gate on it.
 *
 * Also honours an exitCode already set by the caller. A suite that ABORTS
 * partway (fixture insert failed, server died) may have zero recorded failures
 * and must still not report success — "0 failed" out of 3 assertions that ran
 * is not a pass.
 */
export function finish() {
  console.log(`\n${"=".repeat(48)}`);
  console.log(`  ${results.pass} passed, ${results.fail} failed`);
  console.log("=".repeat(48));
  const aborted = process.exitCode !== undefined && process.exitCode !== 0;
  process.exit(results.fail > 0 || aborted ? 1 : 0);
}
