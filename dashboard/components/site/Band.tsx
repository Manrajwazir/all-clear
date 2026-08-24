import { cn } from "@/lib/utils";
import Container from "./Container";

/**
 * A full-bleed section.
 *
 * Sections on this site are separated by stepping between surfaces —
 * cream → cream-200 → navy — rather than by drawing a rule between
 * them. Two adjacent bands must never use the same tone, or the seam
 * disappears and the page reads as one undifferentiated column.
 */
type Tone = "cream" | "cream-200" | "cream-50" | "navy" | "navy-900";

const TONES: Record<Tone, string> = {
  cream: "bg-cream text-ink",
  "cream-50": "bg-cream-50 text-ink",
  "cream-200": "bg-cream-200 text-ink",
  navy: "bg-navy text-ink-inverse",
  "navy-900": "bg-navy-900 text-ink-inverse",
};

/** Vertical rhythm. `loose` is for the hero and closing CTA. */
const SIZES = {
  tight: "py-[clamp(40px,5vw,64px)]",
  normal: "py-[clamp(56px,7vw,96px)]",
  loose: "py-[clamp(72px,9vw,128px)]",
};

export default function Band({
  tone = "cream",
  size = "normal",
  bleed = false,
  className,
  children,
}: {
  tone?: Tone;
  size?: keyof typeof SIZES;
  /** Skip the Container — for sections that genuinely run edge to edge. */
  bleed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(TONES[tone], SIZES[size], className)}>
      {bleed ? children : <Container>{children}</Container>}
    </section>
  );
}

/**
 * A raised panel. Sits one step lighter than its band, which is what
 * separates it — no border involved.
 */
export function Card({
  on = "cream",
  className,
  children,
}: {
  on?: "cream" | "cream-200" | "navy";
  className?: string;
  children: React.ReactNode;
}) {
  const surface = {
    cream: "bg-cream-50",
    "cream-200": "bg-cream-50",
    navy: "bg-navy-700",
  }[on];

  return (
    <div className={cn(surface, "rounded-soft p-7 sm:p-8", className)}>
      {children}
    </div>
  );
}

/** Small uppercase section label. Replaces the old numbered rail. */
export function Eyebrow({
  inverse = false,
  className,
  children,
}: {
  inverse?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "label",
        inverse ? "text-accent-on-navy" : "text-accent",
        className,
      )}
    >
      {children}
    </div>
  );
}
