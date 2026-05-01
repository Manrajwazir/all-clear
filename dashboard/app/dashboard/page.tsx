import { createClient } from "@/lib/supabase/server";
import { ViolationFeed } from "@/components/feed/ViolationFeed";
import type { ViolationWithCamera } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: violationsData } = await supabase
    .from("violations")
    .select("*, cameras(name, sites(name))")
    .order("detected_at", { ascending: false })
    .limit(50);

  const { data: camerasData, count: totalCameras } = await supabase
    .from("cameras")
    .select("id", { count: "exact" });

  const initialViolations =
    (violationsData as ViolationWithCamera[] | null) ?? [];
  const cameraCount = totalCameras ?? camerasData?.length ?? 0;

  // Phase 4 MVP: every camera registered = "active"
  // (real heartbeat tracking is Phase 5+)
  return (
    <ViolationFeed
      initialViolations={initialViolations}
      totalCameras={cameraCount}
      activeCameras={cameraCount}
    />
  );
}
