import Link from "next/link";
import { cn } from "@/lib/utils";

const base =
  "label inline-flex w-full min-[420px]:w-auto items-center justify-center " +
  "min-h-[52px] px-8 text-center transition-colors duration-150";

/** Primary action. Accent on cream, cream on navy. */
export function PrimaryCTA({
  href,
  inverse = false,
  className,
  children,
}: {
  href: string;
  inverse?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        base,
        inverse
          ? "bg-cream text-navy hover:bg-cream-50"
          : "bg-accent text-cream hover:bg-accent-hover",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function SecondaryCTA({
  href,
  inverse = false,
  className,
  children,
}: {
  href: string;
  inverse?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        base,
        inverse
          ? "border border-rule-inverse-strong text-ink-inverse hover:bg-cream/10"
          : "border border-rule-strong text-ink hover:border-ink hover:bg-ink/[0.04]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Inline "read more →" link. The 44px tap area lives on the anchor while
 * the underline stays tight to the text.
 */
export function ArrowLink({
  href,
  inverse = false,
  className,
  children,
}: {
  href: string;
  inverse?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex min-h-[44px] items-center",
        inverse ? "text-accent-on-navy" : "text-accent",
        className,
      )}
    >
      <span
        className={cn(
          "label inline-flex items-center gap-3 border-b pb-1 transition-colors",
          inverse
            ? "border-accent-on-navy/50 group-hover:text-ink-inverse"
            : "border-accent/40 group-hover:text-accent-hover",
        )}
      >
        {children}
        <span aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}

/** Tappable inline mailto. */
export function MailLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href="mailto:hello@allclearsafety.ca"
      className={cn(
        "group inline-flex min-h-[44px] items-center text-accent",
        className,
      )}
    >
      <span className="border-b border-accent/40 pb-0.5 transition-colors group-hover:text-accent-hover">
        {children}
      </span>
    </a>
  );
}
