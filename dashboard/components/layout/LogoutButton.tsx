"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-md",
        "bg-surface-elevated text-text-primary hover:bg-surface-inset",
        "text-[13px] font-medium transition-colors",
      )}
    >
      <LogOut size={14} />
      Sign out
    </button>
  );
}
