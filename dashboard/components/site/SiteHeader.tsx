"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import Container from "./Container";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the panel whenever we land on a new page.
  useEffect(() => setOpen(false), [pathname]);

  // Escape closes it, so the menu is never a trap on a keyboard.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // On /contact the pilot CTA would point at the page you are already on.
  const showCTA = pathname !== "/contact";

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-cream">
      <Container>
        <div className="flex h-[68px] items-center justify-between gap-6 sm:h-[76px]">
          <Link href="/" className="flex min-h-[44px] items-center gap-3">
            <span className="text-[17px] font-medium leading-none tracking-[0.18em]">
              ALL CLEAR
            </span>
            <span className="hidden font-mono text-[10px] tracking-[0.14em] text-slate min-[380px]:inline">
              EDMONTON, AB
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 lg:flex">
            {NAV.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "label-mono pb-1 transition-colors",
                    active
                      ? "border-b border-navy text-navy"
                      : "border-b border-transparent text-slate hover:text-navy",
                  )}
                >
                  {label}
                </Link>
              );
            })}
            {showCTA && (
              <Link
                href="/contact"
                className="label-mono bg-navy px-[22px] py-[13px] text-cream transition-colors hover:bg-slate"
              >
                Request a pilot
              </Link>
            )}
          </nav>

          {/* Mobile trigger — 44px square so it is reachable with a thumb */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="-mr-2 flex h-11 w-11 items-center justify-center lg:hidden"
          >
            <span className="relative block h-[13px] w-[22px]">
              <span
                className={cn(
                  "absolute left-0 block h-px w-full bg-navy transition-transform duration-200",
                  open ? "top-1.5 rotate-45" : "top-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1.5 block h-px w-full bg-navy transition-opacity duration-200",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 block h-px w-full bg-navy transition-transform duration-200",
                  open ? "top-1.5 -rotate-45" : "top-3",
                )}
              />
            </span>
          </button>
        </div>
      </Container>

      {/* Mobile panel */}
      {open && (
        <nav
          id="site-menu"
          className="border-t border-rule bg-cream lg:hidden"
        >
          <Container>
            {NAV.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "label-mono flex min-h-[56px] items-center border-b border-rule-soft",
                    active ? "text-navy" : "text-slate",
                  )}
                >
                  {label}
                </Link>
              );
            })}
            {showCTA ? (
              <Link
                href="/contact"
                className="label-mono my-5 flex min-h-[56px] items-center justify-center bg-navy px-8 text-cream"
              >
                Request a pilot
              </Link>
            ) : (
              <div className="h-5" />
            )}
          </Container>
        </nav>
      )}
    </header>
  );
}
