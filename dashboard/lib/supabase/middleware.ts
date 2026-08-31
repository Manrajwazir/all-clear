import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

/**
 * Device API routes (Phase 3, Step 3.0d).
 *
 * These carry a device API key, not a browser session, so they must skip the
 * dashboard's session check entirely. Without this, every device call gets a
 * 307 redirect to /login and an HTML page — and the symptom on the device is
 * an HTML parse error, which looks like a client bug rather than a one-line
 * config omission.
 *
 * ⚠ ENUMERATE EACH ROUTE. Never match on the `/api/v1/` prefix.
 *
 * Every path this function returns true for skips dashboard authentication, so
 * each one must bring its own auth (a device API key, via device-auth.ts) and
 * its own rate limiting. A future /api/v1/admin/... route silently inheriting
 * "public" from a prefix match is how privilege bypasses are born.
 *
 * The snapshot route is matched by exact shape rather than by
 * `startsWith("/api/v1/violations/")` for the same reason — that prefix would
 * also hand a future /api/v1/violations/export the same free pass.
 */
function isDeviceApiRoute(path: string): boolean {
  return (
    path === "/api/v1/devices/provision" ||
    path === "/api/v1/devices/heartbeat" ||
    path === "/api/v1/violations" ||
    /^\/api\/v1\/violations\/[^/]+\/snapshot$/.test(path)
  );
}

export async function updateSession(request: NextRequest) {
  // Answered before the Supabase client is even constructed. A device has no
  // session to refresh, and a heartbeat every 30 seconds from every device
  // should not each cost an auth round trip.
  if (isDeviceApiRoute(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2]),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/_next") ||
    path.startsWith("/api/public") ||
    path.startsWith("/api/pilot-request") ||
    // Unreachable today — the early return above already handled these. Kept
    // so the list stays a complete statement of what does not need a session,
    // and so removing that early return cannot silently break device auth.
    isDeviceApiRoute(path);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── Disabled user session kill (Phase 2, Step 2.11) ──────────────
  // If the user has a valid JWT but their status is not 'active',
  // sign them out and redirect to login with a reason code.
  // This is the application-level kill switch — RLS is the DB-level one.
  if (user && !isPublic) {
    // The `as any` is still required here — see the DEPENDENCY MISMATCH note
    // at the top of lib/supabase/types.ts. It is NOT because the Database type
    // is wrong; it is because @supabase/ssr 0.5.2 instantiates SupabaseClient
    // with the wrong generic arity for the installed supabase-js.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from("users") as any)
      .select("status, role")
      .eq("id", user.id)
      .single() as { data: { status: string; role: string } | null };

    if (!profile || profile.status !== "active") {
      // Sign out to clear cookies, then redirect
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "disabled");
      return NextResponse.redirect(url);
    }

    // ── Role-based route protection ─────────────────────────────────
    // Settings page is org_admin only
    if (path.startsWith("/dashboard/settings") && profile.role !== "org_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

