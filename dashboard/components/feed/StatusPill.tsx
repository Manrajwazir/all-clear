import { cn, formatViolationType } from "@/lib/utils";
import type { ResolutionStatus } from "@/lib/supabase/types";

interface StatusPillProps {
  status: ResolutionStatus;
  detectedAt: string;
  className?: string;
}

export function StatusPill({ status, detectedAt, className }: StatusPillProps) {
  const ageMs = Date.now() - new Date(detectedAt).getTime();
  const isActive = status === "pending" && ageMs < 5 * 60 * 1000;

  if (isActive) {
    return (
      <Pill className={cn("bg-status-warning-bg text-status-warning", className)}>
        <Dot color="var(--status-warning)" />
        Active
      </Pill>
    );
  }
  if (status === "pending") {
    return (
      <Pill className={cn("bg-status-info-bg text-status-info", className)}>
        Pending
      </Pill>
    );
  }
  if (status === "resolved") {
    return (
      <Pill
        className={cn("bg-status-resolved-bg text-status-resolved", className)}
      >
        Resolved
      </Pill>
    );
  }
  return (
    <Pill className={cn("bg-surface-elevated text-text-secondary", className)}>
      False positive
    </Pill>
  );
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-2 py-0.5 rounded-sm",
        "text-[10px] font-medium tracking-[0.08em] uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: color }}
    />
  );
}

export function ViolationLabel({ type }: { type: string }) {
  return (
    <span className="text-[12px] font-semibold tracking-[0.04em] uppercase text-text-primary">
      {formatViolationType(type)}
    </span>
  );
}
