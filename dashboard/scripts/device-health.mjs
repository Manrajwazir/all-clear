/**
 * device-health.mjs — who is reporting, and who went quiet.
 *
 * The operator-facing half of `lib/device-health.mjs`. Read-only: it issues one
 * SELECT and writes nothing.
 *
 * Usage:
 *   node scripts/device-health.mjs
 *   node scripts/device-health.mjs --json
 *
 * Exit code is 1 if any ACTIVE device is not reporting, so this can be the body
 * of a cron check later without being rewritten.
 */

import { pathToFileURL } from "node:url";
import { loadEnv, serviceClient } from "./lib/common.mjs";
import { classifyDevice, summarise } from "../lib/device-health.mjs";

async function main() {
  const json = process.argv.includes("--json");
  loadEnv();
  const db = serviceClient();

  const { data, error } = await db
    .from("devices")
    .select("id, name, status, site_id, last_seen_at")
    .order("last_seen_at", { ascending: true, nullsFirst: true });
  if (error) throw error;

  const now = new Date();
  const rows = data.map((d) => ({ ...d, health: classifyDevice(d, now) }));
  const fleet = summarise(data, now);

  if (json) {
    console.log(JSON.stringify({ fleet, devices: rows }, null, 2));
  } else if (!rows.length) {
    console.log("no devices registered");
  } else {
    for (const r of rows) {
      const since = r.health.secondsSince == null ? "never" : `${r.health.secondsSince}s ago`;
      console.log(
        `${r.health.state.padEnd(11)} ${String(r.name ?? r.id).padEnd(26)} last beat ${since}`,
      );
    }
    console.log(
      `\n${fleet.reporting}/${fleet.total} reporting` +
        (fleet.needsAttention ? `  --  ${fleet.needsAttention} active device(s) NOT reporting` : ""),
    );
    if (fleet.needsAttention) {
      console.log(
        "\nA device that is not reporting means the record for its area has a gap.\n" +
          "An empty stretch of record is not evidence the site was safe.",
      );
    }
  }

  process.exit(fleet.needsAttention ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
