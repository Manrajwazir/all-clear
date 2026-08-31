import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * The service-role Supabase client.
 * Phase 3, Step 3.0b.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ THIS CLIENT BYPASSES ROW LEVEL SECURITY COMPLETELY.
 *
 * Every other Supabase client in this app uses the anon key and is contained
 * by RLS, so a query bug leaks nothing across tenants. This one is not. Here,
 * application logic is the ONLY control, and a missing `.eq("organization_id",
 * …)` is a cross-tenant data exposure rather than an empty result set.
 *
 * Rules, and they are not negotiable:
 *
 *   1. Only device API routes under /api/v1/ may use this. Dashboard pages and
 *      user-facing routes use lib/supabase/server.ts, which respects RLS.
 *   2. Never import it into a Client Component. The `server-only` import above
 *      turns that into a build error rather than a leaked key in a JS bundle.
 *   3. Never widen a query to "all rows" and filter in TypeScript. Scope every
 *      query to the authenticated device's organization at the database.
 *   4. Prefer the RPCs from migration 006 (claim_device, ingest_violation)
 *      over hand-written multi-step logic. They are atomic; a sequence of
 *      client calls is not.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * WHY THE DASHBOARD NEEDS IT NOW, WHEN CLAUDE.md SAYS IT SHOULD NOT
 *
 * CLAUDE.md records the Phase 2 arrangement: service role in the Python
 * backend only, anon key in Next.js. Phase 3 moves the writes off the device
 * and behind an API, which is the whole point of the phase — so the write path
 * moves here with them. A device authenticates with its own API key, not a
 * Supabase session, so there is no RLS identity to attach to it and RLS cannot
 * be the control for these routes. The Python service loses its service-role
 * key entirely in Step 3.4, which is a net reduction in where this key lives:
 * one server we control instead of every field device.
 */

let cached: SupabaseClient<Database> | null = null;

/**
 * Returns the shared service-role client, creating it on first use.
 *
 * Throws a named error listing what is missing rather than constructing a
 * client against `undefined!` and failing later with an opaque network error.
 * The same lesson as the boto3 credential bug in KNOWN_ISSUES finding 1: fail
 * loudly at the point of misconfiguration, never silently fall through to
 * something that looks like it worked.
 */
export function createServiceRoleClient(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Service-role Supabase client cannot be created: missing ${missing.join(", ")}. ` +
        `Set them in dashboard/.env.local locally and in the Vercel project settings ` +
        `for deployments. See dashboard/.env.local.example.`,
    );
  }

  cached = createClient<Database>(url!, serviceRoleKey!, {
    auth: {
      // There is no user and no session here. Persisting or refreshing one
      // would be meaningless at best, and on a shared server instance it is
      // how one request's identity leaks into another's.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}
