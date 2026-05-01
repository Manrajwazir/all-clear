"use client";

import { ChevronRight } from "lucide-react";
import { cn, formatTimeSince } from "@/lib/utils";
import { StatusPill, ViolationLabel } from "./StatusPill";
import { useSignedUrl } from "@/lib/use-signed-url";
import type { ViolationWithCamera } from "@/lib/supabase/types";

interface ViolationCardProps {
  violation: ViolationWithCamera;
  onSelect: (v: ViolationWithCamera) => void;
}

export function ViolationCard({ violation, onSelect }: ViolationCardProps) {
  const ageMs = Date.now() - new Date(violation.detected_at).getTime();
  const isActive =
    violation.resolution_status === "pending" && ageMs < 5 * 60 * 1000;
  const signedUrl = useSignedUrl(violation.image_url);

  const detected = new Date(violation.detected_at);
  const time = detected.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const cameraLabel =
    violation.cameras?.name && violation.cameras?.sites?.name
      ? `${violation.cameras.name} · ${violation.cameras.sites.name}`
      : (violation.cameras?.name ?? "Unknown camera");

  return (
    <button
      type="button"
      onClick={() => onSelect(violation)}
      className={cn(
        "group relative w-full text-left",
        "bg-surface-card hover:bg-surface-elevated",
        "rounded-lg p-4 sm:p-5",
        "transition-colors duration-[180ms]",
        "shadow-card",
        "flex items-center gap-4",
      )}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute left-2 top-2 bottom-2 w-[3px] rounded-full bg-status-warning"
        />
      )}

      <div className="shrink-0">
        {signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedUrl}
            alt=""
            className={cn(
              "h-16 w-16 rounded-md object-cover",
              "ring-1 ring-inset ring-surface-elevated",
            )}
          />
        ) : (
          <div
            className={cn(
              "h-16 w-16 rounded-md grid place-items-center",
              "bg-surface-inset ring-1 ring-inset ring-surface-elevated",
            )}
          >
            <span className="text-[10px] tracking-wider uppercase text-text-tertiary">
              No img
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <ViolationLabel type={violation.violation_type} />
            <div className="mt-1 text-[12px] text-text-secondary truncate">
              {cameraLabel}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono tabular text-[14px] text-text-primary">
              {time}
            </div>
            <div className="font-mono tabular text-[11px] text-text-tertiary mt-0.5">
              {formatTimeSince(violation.detected_at)} ago
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <StatusPill
            status={violation.resolution_status}
            detectedAt={violation.detected_at}
          />
          <span className="font-mono tabular text-[11px] text-text-tertiary">
            {(violation.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <ChevronRight
        size={16}
        className="shrink-0 text-text-tertiary group-hover:text-text-primary transition-colors duration-[180ms]"
      />
    </button>
  );
}
