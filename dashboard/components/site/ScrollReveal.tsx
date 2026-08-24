"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Fades sections in as they scroll into view.
 *
 * Deliberately fail-visible: the hidden state is scoped to `.js-reveal`,
 * a class this component adds to <html> only once it has mounted. If the
 * script never runs — JS disabled, chunk failed to load — the class is
 * never added and every section renders at full opacity. Content is
 * never hidden by CSS that a failure could leave stuck.
 *
 * Elements above the fold do not carry `data-reveal`, so the brief
 * moment before hydration is not visible to the reader.
 */
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;

    // Honour the OS setting, and skip entirely on anything too old to
    // observe intersections — both cases just leave content visible.
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || !("IntersectionObserver" in window)) return;

    root.classList.add("js-reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      // Start the fade a little before the section is fully on screen.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.04 },
    );

    const targets = document.querySelectorAll(
      "[data-reveal]:not(.is-revealed)",
    );
    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
    // Re-scan after a client-side navigation, when new sections mount.
  }, [pathname]);

  return null;
}
