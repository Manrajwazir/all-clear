import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a Date / ISO string as "2h 47m" / "12m 04s" / "47s".
 * Used for "Last violation" countdown in StatusHero.
 */
export function formatTimeSince(input: string | Date | null): string {
  if (!input) return "—";
  const then = typeof input === "string" ? new Date(input) : input;
  const seconds = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const s = seconds % 60;
    return `${minutes}m ${s.toString().padStart(2, "0")}s`;
  }
  const hours = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (hours < 24) return `${hours}h ${m.toString().padStart(2, "0")}m`;
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return `${days}d ${h.toString().padStart(2, "0")}h`;
}

/**
 * Format a violation_type string for display: "no_hardhat" → "NO HARDHAT"
 */
export function formatViolationType(type: string): string {
  return type.replace(/_/g, " ").toUpperCase();
}
