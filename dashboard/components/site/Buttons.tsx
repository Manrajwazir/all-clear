import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Buttons go full-width on the narrowest phones so they can be hit with a
 * thumb, then shrink to their label from 420px up.
 */
const base =
  "label-mono inline-flex w-full min-[420px]:w-auto items-center justify-center " +
  "min-h-[52px] px-8 text-center transition-colors duration-150";

export function SolidCTA({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(base, "bg-navy text-cream hover:bg-slate", className)}
    >
      {children}
    </Link>
  );
}

export function OutlineCTA({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        base,
        "border border-rule-strong text-navy hover:border-navy hover:bg-navy/5",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * The underlined "Read the full pipeline →" link. The outer anchor carries a
 * 44px tap area while the rule stays tight against the text, so the target is
 * thumb-sized without the underline drifting away from the words.
 */
export function ArrowLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex min-h-[44px] items-center text-navy",
        className,
      )}
    >
      <span className="label-mono inline-flex items-center gap-3 border-b border-rule-strong pb-1 transition-colors group-hover:text-slate">
        {children}
        <span aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}

/**
 * An inline mailto that is still comfortably tappable. Same trick as
 * ArrowLink: tap area on the anchor, underline on the inner span.
 */
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
        "group inline-flex min-h-[44px] items-center text-navy",
        className,
      )}
    >
      <span className="border-b border-rule-strong pb-0.5 transition-colors group-hover:text-slate">
        {children}
      </span>
    </a>
  );
}
