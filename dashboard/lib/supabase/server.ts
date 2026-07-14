import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]),
            );
          } catch {
            // Server Component context — ignore (middleware handles refresh).
          }
        },
      },
    },
  );
}

/**
 * Get the current user with their organization role and profile.
 * Returns null if:
 *   - No authenticated session
 *   - User has no profile in the `users` table
 *   - User status is not 'active' (KILL SWITCH)
 *
 * Phase 2, Step 2.11
 */
export async function getUserWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from("users") as any)
    .select("organization_id, role, full_name, phone, status")
    .eq("id", user.id)
    .single() as { data: { organization_id: string; role: string; full_name: string | null; phone: string | null; status: string } | null };

  if (!profile || profile.status !== "active") return null; // ← KILL SWITCH

  return { ...user, ...profile };
}

