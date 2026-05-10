import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = {
  title: "All Clear — AI-Powered Construction Safety Monitoring",
  description:
    "Real-time PPE violation detection for construction sites. Camera to alert in under 5 seconds. Built for Alberta construction.",
};

/* ---------- data helpers ---------- */
async function getStats() {
  try {
    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("violations")
      .select("*", { count: "exact", head: true })
      .gte("detected_at", today.toISOString());

    return { todayCount: count ?? 0, isLive: true };
  } catch {
    return { todayCount: 0, isLive: false };
  }
}

async function getUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/* ---------- page ---------- */
export default async function LandingPage() {
  const [stats, user] = await Promise.all([getStats(), getUser()]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-12 py-4 bg-surface-base/80 backdrop-blur-md">
        <span className="font-mono text-[13px] tracking-[0.12em] text-text-primary font-semibold">
          ALL CLEAR
        </span>
        <div className="flex items-center gap-4">
          {stats.isLive && (
            <span className="hidden sm:flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase text-status-safe">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-safe opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-status-safe" />
              </span>
              System active
            </span>
          )}
          <Link
            href={user ? "/dashboard" : "/login"}
            className="px-4 py-2 text-[11px] tracking-[0.1em] uppercase font-medium rounded-md bg-status-safe text-text-on-status hover:brightness-110 transition-all duration-200"
          >
            {user ? "Dashboard" : "Sign in"}
          </Link>
        </div>
      </nav>

      {/* ── Section 1: Hero ── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 sm:px-12 text-center pt-20">
        {/* Background GIF — faded, loops automatically */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {/* Gradient overlay keeps text readable over the GIF */}
          <div className="absolute inset-0 bg-gradient-to-b from-surface-base/80 via-surface-base/70 to-surface-base z-10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.compscience.com/wp-content/themes/compscience-2025/assets/images/safety-ai.gif"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover"
            style={{ opacity: 1 }}
          />
        </div>

        <div className="relative z-20 max-w-4xl mx-auto">
          <p className="text-[10px] sm:text-[11px] tracking-[0.25em] uppercase text-text-tertiary mb-6 sm:mb-8">
            Construction site AI safety
          </p>

          <h1 className="text-[48px] sm:text-[72px] lg:text-[88px] font-semibold leading-[0.95] tracking-[-0.03em] text-text-primary">
            Violation to
            <br />
            alert in
            <br />
            <span className="font-mono text-status-safe">&lt; 5s</span>
          </h1>

          <p className="mt-8 sm:mt-10 text-[14px] sm:text-[16px] text-text-secondary max-w-lg mx-auto leading-relaxed">
            Real-time PPE detection for construction sites.
            No new hardware. No training. Plug in a camera and go.
          </p>

          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#pilot"
              className="px-8 py-3.5 text-[12px] tracking-[0.1em] uppercase font-semibold rounded-md bg-status-safe text-text-on-status hover:brightness-110 transition-all duration-200 shadow-glow-safe"
            >
              Request a pilot
            </a>
            <a
              href="#how-it-works"
              className="px-8 py-3.5 text-[12px] tracking-[0.1em] uppercase font-medium rounded-md bg-transparent text-text-secondary ring-1 ring-inset ring-white/10 hover:ring-white/20 hover:text-text-primary transition-all duration-200"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <div className="w-[1px] h-12 bg-gradient-to-b from-transparent to-text-tertiary opacity-40 animate-pulse" />
        </div>
      </section>

      {/* ── Section 2: Problem ── */}
      <section className="px-6 sm:px-12 py-24 sm:py-32">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] tracking-[0.25em] uppercase text-text-tertiary mb-4">
            The problem
          </p>
          <h2 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.02em] text-text-primary mb-16 max-w-2xl">
            Safety compliance on construction sites is invisible until someone gets hurt.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <ProblemCard
              number="01"
              title="No proof"
              description="When WCB asks &quot;was PPE enforced that day?&quot; — you have nothing. No timestamps. No photos. Just memory."
            />
            <ProblemCard
              number="02"
              title="No warning"
              description="A worker removes their hardhat. You find out when someone gets hurt. There&apos;s no system watching."
            />
            <ProblemCard
              number="03"
              title="No record"
              description="COR auditors want compliance data. You have a binder of checkmarks and a hope that nothing happened."
            />
          </div>
        </div>
      </section>

      {/* ── Section 3: How It Works ── */}
      <section id="how-it-works" className="px-6 sm:px-12 py-24 sm:py-32 bg-surface-card/50">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] tracking-[0.25em] uppercase text-text-tertiary mb-4">
            How it works
          </p>
          <h2 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.02em] text-text-primary mb-16 max-w-2xl">
            Three steps. No complexity.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            <StepCard
              step="01"
              title="Plug in a camera"
              description="Your existing IP cameras. No new hardware. No installation crew. Just an RTSP stream."
              accent="text-status-info"
            />
            <StepCard
              step="02"
              title="AI detects violations"
              description="YOLOv8 runs at 26 FPS on-site. Detects missing hard hats, safety vests, and masks. 93% precision."
              accent="text-status-warning"
            />
            <StepCard
              step="03"
              title="Supervisor gets alerted"
              description="SMS in under 5 seconds. Dashboard shows every violation with photo, timestamp, and confidence score."
              accent="text-status-safe"
            />
          </div>
        </div>
      </section>

      {/* ── Section 4: Proof / System Readout ── */}
      <section className="px-6 sm:px-12 py-24 sm:py-32">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] tracking-[0.25em] uppercase text-text-tertiary mb-4">
            System performance
          </p>
          <h2 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.02em] text-text-primary mb-16 max-w-2xl">
            Real numbers from real tests.
          </h2>

          <div className="bg-surface-card rounded-lg p-6 sm:p-10 ring-1 ring-inset ring-white/[0.04]">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-8">
              <MetricReadout label="Inference speed" value="37.6 ms" sub="per frame" />
              <MetricReadout label="Detection FPS" value="26.6" sub="frames/sec" />
              <MetricReadout label="Precision" value="93%" sub="mAP@50: 84.1%" />
              <MetricReadout label="Alert latency" value="< 5s" sub="violation → SMS" />
              <MetricReadout label="GPU" value="RTX 4080" sub="CUDA 12.6" />
              <MetricReadout
                label="Today"
                value={String(stats.todayCount)}
                sub="violations detected"
                live
              />
            </div>

            <div className="mt-10 pt-8 border-t border-white/[0.06]">
              <p className="text-[10px] tracking-[0.14em] uppercase text-text-tertiary mb-4">
                Pipeline
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[12px] sm:text-[13px] font-mono text-text-secondary">
                <span>Camera</span>
                <Arrow />
                <span>YOLO</span>
                <Arrow />
                <span>S3</span>
                <Arrow />
                <span>Supabase</span>
                <Arrow />
                <span className="text-status-safe">SMS Alert</span>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/[0.06]">
              <p className="text-[10px] tracking-[0.14em] uppercase text-text-tertiary mb-4">
                Backed by
              </p>
              <div className="flex flex-wrap gap-6 text-[12px] text-text-secondary">
                <span>Edmonton Unlimited</span>
                <span className="text-text-tertiary">·</span>
                <span>Alberta Innovates</span>
                <span className="text-text-tertiary">·</span>
                <span>City of Edmonton</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: Pricing ── */}
      <section className="px-6 sm:px-12 py-24 sm:py-32 bg-surface-card/50">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.25em] uppercase text-text-tertiary mb-4">
            Pricing
          </p>
          <h2 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.02em] text-text-primary mb-6">
            Simple. Predictable. No surprises.
          </h2>

          <div className="mt-12 bg-surface-base rounded-lg p-8 sm:p-12 ring-1 ring-inset ring-white/[0.06]">
            <p className="text-[11px] tracking-[0.18em] uppercase text-text-tertiary mb-2">
              Starting at
            </p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="font-mono text-[56px] sm:text-[72px] font-semibold text-text-primary tracking-tight leading-none">
                $500
              </span>
              <span className="text-[14px] text-text-tertiary">
                / month / site
              </span>
            </div>

            <p className="mt-6 text-[13px] text-text-secondary leading-relaxed max-w-md mx-auto">
              Unlimited cameras. Real-time alerts. Supervisor dashboard.
              Compliance-ready violation logs.
            </p>

            <p className="mt-4 text-[11px] text-text-tertiary">
              No setup fee · No annual contract · Cancel anytime
            </p>

            <a
              href="#pilot"
              className="inline-block mt-8 px-8 py-3.5 text-[12px] tracking-[0.1em] uppercase font-semibold rounded-md bg-status-safe text-text-on-status hover:brightness-110 transition-all duration-200 shadow-glow-safe"
            >
              Request a pilot
            </a>
          </div>
        </div>
      </section>

      {/* ── Section 6: CTA ── */}
      <section id="pilot" className="px-6 sm:px-12 py-24 sm:py-32">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.02em] text-text-primary mb-4">
            Ready to see it on your site?
          </h2>
          <p className="text-[14px] text-text-secondary mb-12 max-w-lg mx-auto">
            We&apos;ll set up a 30-minute live demo with your cameras.
            No commitment. No credit card.
          </p>

          <form
            action="mailto:manrajwazir@gmail.com"
            method="GET"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left"
          >
            <InputField label="Name" name="subject" placeholder="Your name" />
            <InputField label="Email" name="cc" placeholder="you@company.com" type="email" />
            <InputField label="Company" name="company" placeholder="Your construction company" />
            <InputField label="Number of sites" name="sites" placeholder="e.g. 3" />
            <div className="sm:col-span-2 mt-2">
              <button
                type="submit"
                className="w-full px-8 py-3.5 text-[12px] tracking-[0.1em] uppercase font-semibold rounded-md bg-status-safe text-text-on-status hover:brightness-110 transition-all duration-200 shadow-glow-safe"
              >
                Request a pilot
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 sm:px-12 py-12 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] tracking-[0.12em] text-text-tertiary font-semibold">
              SITEIQ
            </span>
            <span className="text-[11px] text-text-tertiary">
              Edmonton, AB · Built for Canadian construction
            </span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-text-tertiary">
            <a href="mailto:manrajwazir@gmail.com" className="hover:text-text-secondary transition-colors">
              Contact
            </a>
            <a
              href="https://github.com/Manrajwazir/SiteIQ"  /* repo name stays as-is on GitHub */
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-secondary transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- sub-components ---------- */

function ProblemCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group bg-surface-card rounded-lg p-6 sm:p-8 ring-1 ring-inset ring-white/[0.04] hover:ring-white/[0.08] transition-all duration-300">
      <span className="font-mono text-[11px] text-status-warning tracking-wider">
        {number}
      </span>
      <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.01em] text-text-primary uppercase">
        {title}
      </h3>
      <p
        className="mt-3 text-[13px] text-text-secondary leading-relaxed"
        dangerouslySetInnerHTML={{ __html: description }}
      />
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
  accent,
}: {
  step: string;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="relative">
      <span className={`font-mono text-[32px] sm:text-[40px] font-bold ${accent} opacity-20 leading-none`}>
        {step}
      </span>
      <h3 className="mt-2 text-[16px] font-semibold tracking-[-0.01em] text-text-primary">
        {title}
      </h3>
      <p className="mt-3 text-[13px] text-text-secondary leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function MetricReadout({
  label,
  value,
  sub,
  live,
}: {
  label: string;
  value: string;
  sub: string;
  live?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.14em] uppercase text-text-tertiary mb-2 flex items-center gap-2">
        {label}
        {live && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-safe opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-status-safe" />
          </span>
        )}
      </p>
      <p className="font-mono text-[24px] sm:text-[28px] font-semibold text-text-primary tracking-tight leading-none">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-text-tertiary font-mono">
        {sub}
      </p>
    </div>
  );
}

function Arrow() {
  return (
    <span className="text-text-tertiary text-[10px]">→</span>
  );
}

function InputField({
  label,
  name,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[9px] tracking-[0.12em] uppercase text-text-tertiary mb-1.5"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-surface-card text-[13px] text-text-primary placeholder:text-text-tertiary rounded-md ring-1 ring-inset ring-white/[0.06] focus:ring-status-safe/50 focus:outline-none transition-all duration-200"
      />
    </div>
  );
}
