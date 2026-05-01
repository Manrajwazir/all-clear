"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, AlertTriangle } from "lucide-react";
import { cn, formatTimeSince, formatViolationType } from "@/lib/utils";
import { StatusPill } from "./StatusPill";
import { createClient } from "@/lib/supabase/client";
import type {
  ResolutionStatus,
  ViolationWithCamera,
} from "@/lib/supabase/types";

interface DetailPanelProps {
  violation: ViolationWithCamera | null;
  onClose: () => void;
  onResolved: (id: string, status: ResolutionStatus) => void;
}

export function DetailPanel({
  violation,
  onClose,
  onResolved,
}: DetailPanelProps) {
  const [busy, setBusy] = useState(false);

  async function mark(status: ResolutionStatus) {
    if (!violation) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("violations")
      .update({
        resolution_status: status,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", violation.id);
    setBusy(false);
    if (!error) {
      onResolved(violation.id, status);
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {violation && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 md:bg-black/20"
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed top-0 right-0 bottom-0 z-50",
              "w-full sm:w-[420px]",
              "bg-surface-card",
              "shadow-modal",
              "flex flex-col",
              "overflow-y-auto",
            )}
          >
            <header className="flex items-start justify-between p-6 pb-4">
              <div>
                <div className="text-[10px] tracking-[0.12em] uppercase text-text-tertiary mb-2">
                  Violation
                </div>
                <h2 className="text-[24px] font-semibold tracking-tight leading-tight">
                  {formatViolationType(violation.violation_type)}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="h-8 w-8 grid place-items-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <X size={18} />
              </button>
            </header>

            <div className="px-6">
              {violation.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={violation.image_url}
                  alt="Violation snapshot"
                  className="w-full aspect-video object-cover rounded-lg ring-1 ring-inset ring-surface-elevated"
                />
              ) : (
                <div className="w-full aspect-video rounded-lg bg-surface-inset grid place-items-center">
                  <span className="text-[12px] tracking-wider uppercase text-text-tertiary">
                    No snapshot available
                  </span>
                </div>
              )}
            </div>

            <div className="px-6 mt-6">
              <StatusPill
                status={violation.resolution_status}
                detectedAt={violation.detected_at}
              />
            </div>

            <dl className="px-6 mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
              <Field
                label="Detected"
                value={new Date(violation.detected_at).toLocaleString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  month: "short",
                  day: "2-digit",
                  hour12: false,
                })}
                mono
              />
              <Field
                label="Age"
                value={formatTimeSince(violation.detected_at)}
                mono
              />
              <Field
                label="Confidence"
                value={`${(violation.confidence * 100).toFixed(1)}%`}
                mono
              />
              <Field
                label="Camera"
                value={violation.cameras?.name ?? "—"}
              />
              <Field
                label="Site"
                value={violation.cameras?.sites?.name ?? "—"}
              />
              <Field
                label="ID"
                value={violation.id.slice(0, 8)}
                mono
              />
            </dl>

            <div className="mt-auto p-6 pt-8">
              {violation.resolution_status === "pending" ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => mark("resolved")}
                    className={cn(
                      "h-11 rounded-md text-[13px] font-medium",
                      "bg-text-primary text-surface-base",
                      "hover:opacity-90 disabled:opacity-50",
                      "transition-opacity",
                      "inline-flex items-center justify-center gap-2",
                    )}
                  >
                    <Check size={16} />
                    Mark resolved
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => mark("false_positive")}
                    className={cn(
                      "h-11 rounded-md text-[13px] font-medium",
                      "bg-surface-elevated text-text-primary",
                      "hover:bg-surface-inset disabled:opacity-50",
                      "transition-colors",
                      "inline-flex items-center justify-center gap-2",
                    )}
                  >
                    <AlertTriangle size={16} />
                    False positive
                  </button>
                </div>
              ) : (
                <div className="text-[12px] text-text-secondary">
                  Resolved{" "}
                  {violation.resolved_at
                    ? formatTimeSince(violation.resolved_at) + " ago"
                    : ""}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] tracking-[0.08em] uppercase text-text-tertiary mb-1">
        {label}
      </dt>
      <dd
        className={cn(
          "text-[13px] text-text-primary",
          mono && "font-mono tabular",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
