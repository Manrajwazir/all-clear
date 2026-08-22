import { cn } from "@/lib/utils";

/**
 * A grid whose 1px gaps show the background through as hairlines between
 * cells. Collapsing to one column keeps working: the gaps simply become
 * horizontal rules instead of a cross.
 */
export function HairlineGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function HairlineCell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("bg-cream p-7 sm:px-8", className)}>{children}</div>
  );
}
