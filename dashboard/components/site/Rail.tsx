import { cn } from "@/lib/utils";
import Container from "./Container";

/**
 * The layout that repeats down every page: a narrow mono label in a left rail
 * with the content beside it. Below 1024px the rail becomes a heading stacked
 * above its section, which is what makes the pages readable on a phone.
 */
export function RailSection({
  label,
  inverse = false,
  className,
  children,
}: {
  label: React.ReactNode;
  inverse?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Container
      className={cn(
        "grid grid-cols-1 gap-y-3.5 lg:grid-cols-[200px_1fr] lg:gap-x-14",
        className,
      )}
    >
      <div
        className={cn(
          "label-mono",
          inverse ? "text-slate-light" : "text-slate",
        )}
      >
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </Container>
  );
}

/**
 * A full-bleed band. On cream it is separated by a hairline; on navy the
 * colour change does the separating, so the rule is dropped.
 */
export function Band({
  inverse = false,
  divided = true,
  className,
  children,
}: {
  inverse?: boolean;
  divided?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        inverse
          ? "bg-navy text-cream"
          : divided && "border-t border-rule",
        className,
      )}
    >
      {children}
    </section>
  );
}
