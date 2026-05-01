"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Clock,
  Video,
  FileText,
  Settings,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOP_ITEMS = [
  { href: "/dashboard", label: "Live", icon: Activity },
  { href: "/dashboard/history", label: "History", icon: Clock },
  { href: "/dashboard/cameras", label: "Cameras", icon: Video },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
] as const;

const BOTTOM_ITEMS = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/account", label: "Account", icon: User },
] as const;

export function NavRail() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: vertical rail */}
      <aside
        className={cn(
          "hidden md:flex",
          "fixed left-0 top-0 bottom-0 z-40",
          "w-[60px] flex-col items-center justify-between py-4",
          "bg-surface-base",
        )}
      >
        <div className="flex flex-col items-center gap-1">
          <div className="h-10 w-10 grid place-items-center mb-4">
            <span className="font-mono text-[10px] tracking-[0.18em] text-text-secondary">
              SQ
            </span>
          </div>
          {TOP_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </div>
        <div className="flex flex-col items-center gap-1">
          {BOTTOM_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </div>
      </aside>

      {/* Mobile: bottom tab bar */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 z-40",
          "h-14 bg-surface-base flex items-center justify-around px-2",
          "shadow-elevated",
        )}
      >
        {[...TOP_ITEMS, BOTTOM_ITEMS[0]].map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group relative h-10 w-10 grid place-items-center rounded-md",
        "text-text-tertiary hover:text-text-primary",
        "transition-colors duration-[180ms]",
        active && "text-text-primary",
      )}
    >
      <Icon size={18} strokeWidth={1.75} />

      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-text-primary"
        />
      )}

      <span
        className={cn(
          "hidden md:block",
          "absolute left-12 top-1/2 -translate-y-1/2",
          "px-2 py-1 rounded-md bg-surface-elevated",
          "text-[11px] tracking-wider uppercase text-text-secondary",
          "opacity-0 group-hover:opacity-100 pointer-events-none",
          "transition-opacity duration-[180ms] whitespace-nowrap",
          "shadow-elevated",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
