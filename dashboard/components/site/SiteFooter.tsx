import Link from "next/link";
import Container from "./Container";

const SITE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
];

export default function SiteFooter() {
  return (
    <footer className="bg-navy-900 text-ink-inverse">
      <Container className="grid grid-cols-1 gap-10 pb-10 pt-[clamp(48px,6vw,72px)] sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] lg:gap-16">
        <div>
          <div className="mb-4 text-[15px] font-medium tracking-[0.18em]">
            ALL CLEAR
          </div>
          <p className="text-[14px] leading-[1.9] text-ink-inverse-muted">
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
          <FooterLink href="/assessment">Request an assessment</FooterLink>
          <FooterLink href="mailto:hello@allclearsafety.ca">
            hello@allclearsafety.ca
          </FooterLink>
          <FooterLink href="/privacy">Privacy policy</FooterLink>
        </FooterColumn>
      </Container>

      <Container className="pb-[clamp(24px,4vw,48px)]">
        {/* The registered entity is a numbered Alberta corporation; the
            "All Clear" trade name is not filed yet, so the legal name
            appears here rather than in any headline. */}
        <p className="text-[12px] leading-[1.8] text-ink-inverse-muted">
          &copy; 2026 2819394 Alberta Corp., operating as All Clear.
        </p>
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
      <div className="label mb-2 text-accent-on-navy">{heading}</div>
      {children}
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const className =
    "flex min-h-[44px] items-center text-[14px] text-ink-inverse transition-colors hover:text-accent-on-navy";

  if (href.startsWith("mailto:")) {
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
