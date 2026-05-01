"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildDemoViolations } from "@/lib/demo-data";
import type { ViolationWithCamera } from "@/lib/supabase/types";

export function DemoModeBar({
  onLoad,
}: {
  onLoad: (demos: ViolationWithCamera[]) => void;
}) {
  const [active, setActive] = useState(false);

  function handleClick() {
    onLoad(buildDemoViolations());
    setActive(true);
  }

  return (
    <div className="px-6 sm:px-12">
      <div
        className={cn(
          "flex items-center justify-between gap-4 flex-wrap",
          "bg-surface-card rounded-md px-4 py-3",
        )}
      >
        <div className="flex items-center gap-3">
          <Sparkles size={14} className="text-status-info" />
          <span className="text-[11px] tracking-[0.08em] uppercase text-text-secondary">
            Demo mode
          </span>
          <span className="text-[12px] text-text-tertiary hidden sm:inline">
            Load pre-seeded violations to demo without a live camera
          </span>
        </div>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "h-8 px-3 rounded-md text-[11px] font-medium tracking-[0.04em] uppercase",
            "transition-colors duration-[180ms]",
            active
              ? "bg-status-info-bg text-status-info"
              : "bg-surface-elevated text-text-primary hover:bg-surface-inset",
          )}
        >
          {active ? "Loaded" : "Load demo data"}
        </button>
      </div>
    </div>
  );
}
