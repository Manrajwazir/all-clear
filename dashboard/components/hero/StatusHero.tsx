"use client";

import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Metric } from "./Metric";
import { LiveTimer } from "./LiveTimer";
import type { StatusSnapshot } from "@/lib/status";

interface StatusHeroProps {
  snapshot: StatusSnapshot;
  activeCameras: number;
  totalCameras: number;
}

export function StatusHero({
  snapshot,
  activeCameras,
  totalCameras,
}: StatusHeroProps) {
  const { status, word, todayCount, lastViolationAt } = snapshot;

  return (
    <section className="px-6 sm:px-12 pt-12 sm:pt-16 pb-8 sm:pb-12">
      <div className="text-[10px] tracking-[0.2em] uppercase text-text-tertiary mb-6 sm:mb-8">
        Site overview · today
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.h1
            key={word}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "leading-none font-semibold tracking-[-0.02em]",
              "text-[64px] sm:text-[88px] lg:text-[96px]",
              status === "safe" && "text-status-safe",
              status === "warning" &&
                "text-status-warning animate-pulse-status",
              status === "critical" &&
                "text-status-critical animate-pulse-status-fast",
            )}
            style={{
              textShadow:
                status === "critical"
                  ? "0 0 48px rgba(255, 71, 71, 0.3)"
                  : status === "warning"
                    ? "0 0 32px rgba(255, 176, 32, 0.2)"
                    : "0 0 32px rgba(0, 217, 163, 0.15)",
            }}
          >
            {word}
          </motion.h1>
        </AnimatePresence>
      </div>

      <div className="mt-12 sm:mt-16 grid grid-cols-3 gap-6 sm:gap-12">
        <LiveTimer lastViolationAt={lastViolationAt} />
        <Metric
          label="Active cameras"
          value={`${activeCameras} / ${totalCameras}`}
        />
        <Metric label="Today" value={todayCount} />
      </div>
    </section>
  );
}
