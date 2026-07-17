import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * POST /api/pilot-request
 *
 * Accepts a pilot request form submission from the landing page.
 * Stores the lead in the pilot_requests table (anon INSERT policy).
 *
 * This route uses the anon key — no auth required, no service role
 * key needed. The anon INSERT RLS policy on pilot_requests allows this.
 */

const pilotRequestSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Valid email required").max(200),
  company: z.string().min(1, "Company name is required").max(200),
  num_sites: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const parsed = pilotRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid form data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, company, num_sites } = parsed.data;

    // Use anon client — RLS INSERT policy allows public submissions
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from("pilot_requests")
      .insert({ name, email, company, num_sites: num_sites ?? null });

    if (error) {
      console.error("Pilot request insert failed:", error.message);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Pilot request route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
