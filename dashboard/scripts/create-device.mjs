/**
 * create-device.mjs — register a device and mint its one-time provisioning token.
 * Phase 3, Step 3.1.
 *
 * This is the device-creation path until the Phase 5 settings UI exists. It is
 * an admin tool: it uses the SERVICE ROLE key and bypasses RLS entirely.
 *
 * Usage:
 *   node scripts/create-device.mjs --list-sites
 *   node scripts/create-device.mjs --site <site-uuid> --name "Trailer Pi 01"
 *
 * What it does NOT do, deliberately: it does not activate the device. It
 * writes a row with status='pending' and the SHA-256 of a fresh provisioning
 * token, then prints the token once. The device activates itself by presenting
 * that token to POST /api/v1/devices/provision, which is the only code path
 * that may set status='active'. Two ways to activate a device would eventually
 * be two sets of rules about when activation is allowed.
 */

import {
  generateProvisioningToken,
  loadEnv,
  serviceClient,
  sha256Hex,
} from "./lib/common.mjs";

loadEnv();
const db = serviceClient();

/** Matches the 48h TTL described in ADR 0002 and enforced by claim_device(). */
const TOKEN_TTL_HOURS = 48;

/** Where the dashboard is running, for the printed activation command. */
const API_URL = process.env.ALLCLEAR_API_URL ?? "http://localhost:3000";

function parseArgs(argv) {
  const args = { listSites: false, site: null, name: null };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--list-sites":
        args.listSites = true;
        break;
      case "--site":
        args.site = argv[++i];
        break;
      case "--name":
        args.name = argv[++i];
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        process.exit(1);
    }
  }
  return args;
}

async function listSites() {
  const { data, error } = await db
    .from("sites")
    .select("id, name, organization_id, pipa_attestation_completed, snapshot_mode")
    .order("name");

  if (error) {
    console.error(`Could not list sites: ${error.message}`);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log("No sites found. Create one before registering a device.");
    return;
  }

  console.log("\nSites:\n");
  for (const s of data) {
    const attested = s.pipa_attestation_completed ? "attested" : "NOT ATTESTED";
    const snap = s.snapshot_mode ? "snapshots on" : "snapshots off";
    console.log(`  ${s.id}`);
    console.log(`    ${s.name}  [${attested}, ${snap}]`);
  }
  console.log("");
}

async function createDevice(siteId, name) {
  // 1. Resolve the site. organization_id comes from the site row, never from
  //    an argument — the same rule the API follows (ADR 0006). A mistyped org
  //    on the command line would put a device in the wrong tenant.
  const { data: site, error: siteErr } = await db
    .from("sites")
    .select("id, name, organization_id, pipa_attestation_completed")
    .eq("id", siteId)
    .maybeSingle();

  if (siteErr) {
    console.error(`Site lookup failed: ${siteErr.message}`);
    process.exit(1);
  }
  if (!site) {
    console.error(`No site with id ${siteId}. Run with --list-sites to see them.`);
    process.exit(1);
  }

  // 2. Mint the token. The plaintext exists only in this process and in the
  //    line printed at the end; only its hash is written.
  const token = generateProvisioningToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: device, error: insertErr } = await db
    .from("devices")
    .insert({
      organization_id: site.organization_id,
      site_id: site.id,
      name,
      status: "pending",
      provisioning_token_hash: tokenHash,
      provisioning_token_expires_at: expiresAt,
    })
    .select("id, name, status")
    .single();

  if (insertErr) {
    console.error(`Device insert failed: ${insertErr.message}`);
    process.exit(1);
  }

  console.log("\n" + "=".repeat(68));
  console.log("  DEVICE REGISTERED");
  console.log("=".repeat(68));
  console.log(`  Device ID : ${device.id}`);
  console.log(`  Name      : ${device.name}`);
  console.log(`  Site      : ${site.name}`);
  console.log(`  Status    : ${device.status}  (activates on first provision call)`);
  console.log(`  Expires   : ${expiresAt}  (${TOKEN_TTL_HOURS}h)`);
  console.log("");
  console.log("  PROVISIONING TOKEN — shown once, only its hash is stored:");
  console.log("");
  console.log(`    ${token}`);
  console.log("");
  // BOTH shells, always.
  //
  // This printed only a bash-style curl until 2026-08-31, which is broken
  // advice on the platform this project is actually developed on: in Windows
  // PowerShell `curl` is an alias for Invoke-WebRequest, which rejects -X, -H
  // and -d outright, and `\` is not a line continuation. A tool that hands the
  // operator a command that cannot run is worse than one that prints nothing.
  // ⚠ CAPTURE THE KEY, DO NOT READ IT OFF THE SCREEN.
  //
  // The first version of this told the operator to run Invoke-RestMethod and
  // copy the api_key out of the printed object. That lost 20 characters of a
  // 68-character key to terminal formatting, and the resulting symptom was a
  // flat 401 with no hint that the key was merely truncated — the key_id half
  // survives, so the device looks real right up until the hash comparison.
  //
  // Both forms below now write the key straight to a file. The key is shown
  // exactly once and cannot be recovered, so the copy has to be reliable.
  console.log("  Activate the device — PowerShell (Windows):");
  console.log("");
  console.log(`    $r = Invoke-RestMethod -Uri "${API_URL}/api/v1/devices/provision" \``);
  console.log(`      -Method Post -ContentType "application/json" \``);
  console.log(`      -Body '{"provisioning_token":"${token}"}'`);
  console.log(`    $r.api_key | Set-Content -NoNewline -Encoding ascii device_key.txt`);
  console.log(`    Get-Content device_key.txt   # verify: should be 68 characters`);
  console.log("");
  console.log("  Activate the device — bash / macOS / Linux:");
  console.log("");
  console.log(`    curl -s -X POST ${API_URL}/api/v1/devices/provision \\`);
  console.log(`      -H "Content-Type: application/json" \\`);
  console.log(`      -d '{"provisioning_token":"${token}"}' \\`);
  console.log(`      | python -c "import json,sys;print(json.load(sys.stdin)['api_key'],end='')" \\`);
  console.log(`      > device_key.txt`);
  console.log("");
  console.log("  Then paste the file's contents into detection/.env as DEVICE_API_KEY");
  console.log("  and delete device_key.txt. The key is shown ONCE and is 68 chars:");
  console.log("      ac_live_ (8) + key_id (16) + _ (1) + secret (43)");
  console.log("  A short key fails with a plain 401 and no hint that it was truncated.");
  console.log("=".repeat(68));

  if (!site.pipa_attestation_completed) {
    console.log("");
    console.log("  ⚠  THIS SITE IS NOT ATTESTED.");
    console.log("");
    console.log("     The device row exists, but the provision call above will be");
    console.log("     REFUSED with 403 until an organisation administrator completes");
    console.log("     the Alberta PIPA worker-notification attestation for this site.");
    console.log("     Set sites.pipa_attestation_completed once that has genuinely");
    console.log("     happened — it is a record that workers were told, not a flag to");
    console.log("     flip to make an error go away.");
    console.log("");
  }
}

const args = parseArgs(process.argv.slice(2));

if (args.listSites) {
  await listSites();
} else if (!args.site || !args.name) {
  console.log("Usage:");
  console.log("  node scripts/create-device.mjs --list-sites");
  console.log('  node scripts/create-device.mjs --site <site-uuid> --name "Trailer Pi 01"');
  process.exit(1);
} else {
  await createDevice(args.site, args.name);
}
