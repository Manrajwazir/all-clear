import Link from "next/link";
import Container from "./Container";

const SITE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
];

export default function SiteFooter() {
  return (
    <footer className="bg-navy text-cream">
      <Container className="grid grid-cols-1 gap-10 pb-10 pt-[clamp(44px,6vw,64px)] sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] lg:gap-12">
        <div>
          <div className="mb-3.5 text-[15px] font-medium tracking-[0.18em]">
            ALL CLEAR
          </div>
          <p className="font-mono text-[11px] leading-[2] tracking-[0.06em] text-slate-light">
            All Clear Inc. &mdash; 2819394 Alberta Corp.
            <br />
            Edmonton, Alberta, Canada
            <br />
            allclearsafety.ca
          </p>
        </div>

        <FooterColumn heading="Site">
          {SITE_LINKS.map(({ href, label }) => (
            <FooterLink key={href} href={href}>
              {label}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn heading="Contact">
          <FooterLink href="/contact">Request a pilot</FooterLink>
          <FooterLink href="mailto:hello@allclearsafety.ca">
            hello@allclearsafety.ca
          </FooterLink>
          <FooterLink href="/privacy">Privacy policy</FooterLink>
        </FooterColumn>
      </Container>

      <Container className="pb-[clamp(20px,5vw,48px)]">
        <div className="border-t border-rule-inverse-faint pt-5 font-mono text-[10px] tracking-[0.1em] text-slate-light">
          &copy; 2026 ALL CLEAR INC.
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-light">
        {heading}
      </div>
      {children}
    </div>
  );
}

/* Footer rows are 44px tall so they are tappable, not just clickable. */
function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const external = href.startsWith("mailto:");
  const className =
    "flex min-h-[44px] items-center text-[14px] text-cream transition-colors hover:text-slate-light";

  if (external) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
