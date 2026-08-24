"use client";

import Image from "next/image";
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

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // On /assessment the CTA would point at the current page.
  const showCTA = pathname !== "/assessment";

  return (
    <header className="sticky top-0 z-50 bg-navy text-ink-inverse">
      <Container>
        <div className="flex h-[68px] items-center justify-between gap-6 sm:h-[76px]">
          <Link
            href="/"
            className="flex min-h-[44px] items-center gap-3"
          >
             <Image
              src="/icon.png"
              alt="All Clear"
              width={32}
              height={32}
              className="h-8 w-8"
              priority
            />
            <span className="hidden text-[17px] font-medium leading-none tracking-[0.18em] sm:inline">
              ALL CLEAR
            </span>
           
          </Link>

          <nav className="hidden items-center gap-9 lg:flex">
            {NAV.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "label pb-1 transition-colors",
                    active
                      ? "border-b border-cream text-ink-inverse"
                      : "border-b border-transparent text-ink-inverse-muted hover:text-ink-inverse",
                  )}
                >
                  {label}
                </Link>
              );
            })}
            {showCTA && (
              <Link
                href="/assessment"
                className="label rounded-soft bg-cream px-6 py-[14px] text-navy transition-colors hover:bg-cream-50"
              >
                Request an assessment
              </Link>
            )}
          </nav>

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
                  "absolute left-0 block h-px w-full bg-cream transition-transform duration-200",
                  open ? "top-1.5 rotate-45" : "top-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1.5 block h-px w-full bg-cream transition-opacity duration-200",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 block h-px w-full bg-cream transition-transform duration-200",
                  open ? "top-1.5 -rotate-45" : "top-3",
                )}
              />
            </span>
          </button>
        </div>
      </Container>

      {open && (
        <nav id="site-menu" className="bg-navy-900 pb-5 lg:hidden">
          <Container>
            {NAV.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "label flex min-h-[56px] items-center",
                    active ? "text-ink-inverse" : "text-ink-inverse-muted",
                  )}
                >
                  {label}
                </Link>
              );
            })}
            {showCTA && (
              <Link
                href="/assessment"
                className="label mt-3 flex min-h-[56px] items-center justify-center rounded-soft bg-cream px-8 text-navy"
              >
                Request an assessment
              </Link>
            )}
          </Container>
        </nav>
      )}
    </header>
  );
}
