"use client";

import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface MetricProps {
  label: string;
  value: string | number;
  className?: string;
}

export function Metric({ label, value, className }: MetricProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span className="text-[10px] tracking-[0.12em] uppercase text-text-secondary font-medium">
        {label}
      </span>
      <div className="relative h-[56px] flex items-center">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={String(value)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="font-mono tabular text-[28px] sm:text-[42px] lg:text-[56px] leading-none font-semibold text-text-primary tracking-tight"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
