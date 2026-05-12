import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = {
  title: "All Clear — AI-Powered Construction Safety Monitoring",
  description:
    "Real-time PPE violation detection for construction sites. Camera to alert in under 5 seconds. Built for Alberta construction.",
};

/* ---------- data ---------- */
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
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/* ---------- page ---------- */
export default async function LandingPage() {
  const [stats, user] = await Promise.all([getStats(), getUser()]);

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">

      {/* ═══════════════════ NAV ═══════════════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 sm:px-16 py-5 bg-surface-base/60 backdrop-blur-xl">
        <span className="text-[15px] font-semibold tracking-tight">All Clear</span>
        <div className="hidden sm:flex items-center gap-8 text-[14px] text-text-secondary">
          <a href="#how-it-works" className="hover:text-text-primary transition-colors">How it works</a>
          <a href="#performance" className="hover:text-text-primary transition-colors">Performance</a>
          <a href="#pricing" className="hover:text-text-primary transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hidden sm:block text-[14px] text-text-secondary hover:text-text-primary transition-colors">
            Log in
          </Link>
          <Link
            href={user ? "/dashboard" : "#pilot"}
            className="px-5 py-2 text-[13px] font-medium rounded-full border border-white/20 text-text-primary hover:bg-white/[0.06] transition-all"
          >
            {user ? "Dashboard" : "Start for free"}
          </Link>
        </div>
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative min-h-screen flex items-center pt-24 pb-32 overflow-hidden">
        {/* Mesh gradient — teal blob top-left, blue bottom-right like Notio's amber */}
        <div className="absolute inset-0 z-0">
          {/* GIF background — faded behind everything */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.compscience.com/wp-content/themes/compscience-2025/assets/images/safety-ai.gif"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.7 }}
          />
          {/* Dark overlay so text reads clean */}
          <div className="absolute inset-0 bg-surface-base/70" />
          {/* Mesh gradient blobs on top */}
          <div
            className="absolute -top-[30%] -left-[20%] w-[80%] h-[80%] rounded-full"
            style={{
              background: "radial-gradient(ellipse at center, rgba(0,217,163,0.18) 0%, transparent 65%)",
              filter: "blur(80px)",
            }}
          />
          <div
            className="absolute -bottom-[20%] -right-[15%] w-[60%] h-[60%] rounded-full"
            style={{
              background: "radial-gradient(ellipse at center, rgba(74,163,255,0.08) 0%, transparent 65%)",
              filter: "blur(80px)",
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-8 sm:px-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <h1 className="text-[44px] sm:text-[56px] lg:text-[64px] font-light italic leading-[1.05] tracking-[-0.02em]">
              Never Miss A Safety Violation Again
            </h1>
            <p className="mt-6 text-[16px] sm:text-[18px] text-text-secondary leading-relaxed max-w-lg">
              Record, detect, and alert on PPE violations across your construction
              site — all in real-time. Turn every camera into a safety supervisor.
            </p>
            <div className="mt-10">
              <a
                href="#pilot"
                className="inline-flex px-6 py-3 text-[14px] font-medium rounded-full border border-white/25 text-text-primary hover:bg-white/[0.06] transition-all"
              >
                Start for free
              </a>
            </div>
          </div>

          {/* Right — product card mock (like Notio's phone mockup) */}
          <div className="relative">
            <div
              className="rounded-2xl overflow-hidden border border-white/[0.08]"
              style={{
                background: "linear-gradient(135deg, rgba(19,21,27,0.95), rgba(10,11,15,0.98))",
                boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
              }}
            >
              <div className="px-5 py-3 flex items-center justify-between border-b border-white/[0.06] text-[12px] text-text-tertiary">
                <span>Live Detection Feed</span>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-status-safe opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-status-safe" />
                  </span>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <div className="rounded-lg bg-surface-inset p-4 border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-status-critical font-medium">MISSING HARD HAT</span>
                    <span className="text-[10px] text-text-tertiary font-mono">2.3s ago</span>
                  </div>
                  <div className="text-[12px] text-text-secondary">Camera 02 — North Entrance</div>
                  <div className="text-[11px] text-text-tertiary mt-1">Confidence: 94.2%</div>
                </div>
                <div className="rounded-lg bg-surface-inset p-4 border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-status-warning font-medium">MISSING VEST</span>
                    <span className="text-[10px] text-text-tertiary font-mono">14s ago</span>
                  </div>
                  <div className="text-[12px] text-text-secondary">Camera 01 — Loading Bay</div>
                  <div className="text-[11px] text-text-tertiary mt-1">Confidence: 91.8%</div>
                </div>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-text-tertiary">
                  <span>SMS sent to supervisor</span>
                  <span className="text-status-safe">&#10003;</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Partner bar */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/[0.04] py-6 z-10">
          <div className="max-w-7xl mx-auto px-8 sm:px-16 flex flex-wrap items-center justify-center gap-8 sm:gap-14 text-[13px] text-text-tertiary">
            <span className="text-[11px]">Backed by</span>
            <span>Edmonton Unlimited</span>
            <span>Alberta Innovates</span>
            <span>City of Edmonton</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FEATURES ═══════════════════ */}
      <section id="how-it-works" className="py-28 sm:py-36">
        <div className="max-w-7xl mx-auto px-8 sm:px-16 text-center">
          <h2 className="text-[32px] sm:text-[40px] font-light italic leading-[1.1] tracking-[-0.01em]">
            One system for all your sites
          </h2>
          <p className="mt-5 text-[15px] sm:text-[16px] text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Whether it&apos;s a high-rise, a pipeline, or a residential build — detect,
            log, and alert on every PPE violation automatically.
          </p>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <FeatureCard
              title="Plug in a camera"
              description="Your existing IP cameras. No new hardware, no installation crew. Connect an RTSP stream and you're live."
            />
            <FeatureCard
              title="AI detects in real time"
              description="YOLOv8 runs at 26 FPS on-site. Detects missing hard hats, vests, and masks. 93% precision."
            />
            <FeatureCard
              title="Supervisor gets alerted"
              description="SMS in under 5 seconds. Every violation logged with photo, timestamp, and confidence score."
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════ PIPELINE (like Notio's integrations section) ═══════════════════ */}
      <section id="performance" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-8 sm:px-16">
          <div className="rounded-2xl border border-white/[0.06] py-16 sm:py-20 px-8 sm:px-16 text-center">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[14px] sm:text-[16px] font-mono text-text-secondary mb-10">
              <span className="px-4 py-2 rounded-xl border border-white/[0.08] bg-surface-card">Camera</span>
              <span className="text-text-tertiary">&#8594;</span>
              <span className="px-4 py-2 rounded-xl border border-white/[0.08] bg-surface-card">YOLOv8</span>
              <span className="text-text-tertiary">&#8594;</span>
              <span className="px-4 py-2 rounded-xl border border-white/[0.08] bg-surface-card">S3</span>
              <span className="text-text-tertiary">&#8594;</span>
              <span className="px-4 py-2 rounded-xl border border-white/[0.08] bg-surface-card">Supabase</span>
              <span className="text-text-tertiary">&#8594;</span>
              <span className="px-4 py-2 rounded-xl border border-status-safe/20 bg-status-safe/[0.06] text-status-safe">SMS</span>
            </div>
            <h2 className="text-[28px] sm:text-[36px] font-light italic leading-[1.1]">
              End-to-end detection pipeline
            </h2>
            <p className="mt-4 text-[15px] text-text-secondary max-w-xl mx-auto leading-relaxed">
              From camera frame to supervisor SMS in under 5 seconds.
              Fully automated. No human in the loop.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════ STATS ═══════════════════ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-8 sm:px-16 text-center">
          <h2 className="text-[28px] sm:text-[36px] font-light italic leading-[1.1] mb-4">
            Real numbers from real tests
          </h2>
          <p className="text-[15px] text-text-secondary max-w-xl mx-auto mb-16">
            Production metrics from our live detection pipeline. Not projections.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <StatBlock value="37.6ms" label="Inference speed" />
            <StatBlock value="26.6" label="Frames per second" />
            <StatBlock value="93%" label="Detection precision" />
            <StatBlock value="&lt; 5s" label="Alert latency" />
          </div>

          {stats.todayCount > 0 && (
            <div className="mt-12 inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-status-safe/15 bg-status-safe/[0.05]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-safe opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-status-safe" />
              </span>
              <span className="text-[13px] text-status-safe">
                {stats.todayCount} violations detected today
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <section id="pricing" className="py-28 sm:py-36">
        <div className="max-w-7xl mx-auto px-8 sm:px-16 text-center">
          <h2 className="text-[32px] sm:text-[40px] font-light italic leading-[1.1]">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-[15px] text-text-secondary">
            Start free. Scale when you&apos;re ready. Cancel anytime.
          </p>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto text-left">
            {/* Free tier */}
            <div className="rounded-2xl border border-white/[0.06] p-8 bg-surface-card/50">
              <span className="inline-block px-3 py-1 text-[11px] font-medium rounded-full border border-white/10 text-text-secondary mb-6">
                Pilot
              </span>
              <div className="text-[28px] font-semibold tracking-tight mb-1">$0 / month</div>
              <p className="text-[13px] text-text-tertiary mb-6">One site, 30-day trial.</p>
              <a
                href="#pilot"
                className="block w-full py-3 text-center text-[13px] font-medium rounded-full border border-white/15 hover:bg-white/[0.04] transition-all"
              >
                Start for free
              </a>
              <ul className="mt-8 space-y-3 text-[13px] text-text-secondary">
                <Check>1 camera feed</Check>
                <Check>Real-time detection</Check>
                <Check>SMS alerts</Check>
                <Check>Dashboard access</Check>
              </ul>
            </div>

            {/* Paid tier — warm glow border like Notio */}
            <div
              className="rounded-2xl p-8 relative"
              style={{
                border: "1px solid rgba(0,217,163,0.2)",
                background: "linear-gradient(160deg, rgba(0,217,163,0.04) 0%, rgba(19,21,27,0.95) 40%)",
              }}
            >
              <span className="inline-block px-3 py-1 text-[11px] font-medium rounded-full border border-status-safe/20 text-status-safe mb-6">
                Pro
              </span>
              <div className="text-[28px] font-semibold tracking-tight mb-1">$500 / month</div>
              <p className="text-[13px] text-text-tertiary mb-6">Per site. Unlimited cameras.</p>
              <a
                href="#pilot"
                className="block w-full py-3 text-center text-[13px] font-medium rounded-full bg-text-primary text-surface-base hover:opacity-90 transition-opacity"
              >
                Get started
              </a>
              <p className="mt-8 text-[12px] text-text-secondary font-medium mb-4">Everything in Pilot, plus:</p>
              <ul className="space-y-3 text-[13px] text-text-secondary">
                <Check>Unlimited cameras</Check>
                <Check>Compliance violation logs</Check>
                <Check>COR audit reports</Check>
                <Check>Priority support</Check>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FINAL CTA ═══════════════════ */}
      <section id="pilot" className="relative py-32 sm:py-40 overflow-hidden">
        {/* Gradient bg like Notio's footer CTA */}
        <div className="absolute inset-0 z-0">
          <div
            className="absolute top-0 left-[10%] w-[80%] h-[80%] rounded-full"
            style={{
              background: "radial-gradient(ellipse at center, rgba(0,217,163,0.12) 0%, transparent 60%)",
              filter: "blur(100px)",
            }}
          />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto px-8 text-center">
          <h2 className="text-[36px] sm:text-[48px] font-light italic leading-[1.1] tracking-[-0.01em]">
            Ready to see it on your site?
          </h2>
          <p className="mt-5 text-[15px] text-text-secondary leading-relaxed">
            We&apos;ll set up a 30-minute live demo using your cameras. No commitment. No credit card.
          </p>

          <form
            action="mailto:manrajwazir@gmail.com"
            method="GET"
            className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto"
          >
            <input name="subject" placeholder="Your name" className="w-full px-4 py-3 bg-surface-card/80 text-[13px] text-text-primary placeholder:text-text-tertiary rounded-xl border border-white/[0.06] focus:border-white/[0.15] focus:outline-none transition-colors" />
            <input name="cc" type="email" placeholder="you@company.com" className="w-full px-4 py-3 bg-surface-card/80 text-[13px] text-text-primary placeholder:text-text-tertiary rounded-xl border border-white/[0.06] focus:border-white/[0.15] focus:outline-none transition-colors" />
            <input name="company" placeholder="Company name" className="w-full px-4 py-3 bg-surface-card/80 text-[13px] text-text-primary placeholder:text-text-tertiary rounded-xl border border-white/[0.06] focus:border-white/[0.15] focus:outline-none transition-colors" />
            <input name="sites" placeholder="Number of sites" className="w-full px-4 py-3 bg-surface-card/80 text-[13px] text-text-primary placeholder:text-text-tertiary rounded-xl border border-white/[0.06] focus:border-white/[0.15] focus:outline-none transition-colors" />
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full py-3 text-[14px] font-medium rounded-full border border-white/20 hover:bg-white/[0.06] transition-all"
              >
                Request a pilot
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="py-16 text-center">
        <div className="mb-8">
          <span className="text-[15px] font-semibold tracking-tight">All Clear</span>
        </div>
        <div className="flex items-center justify-center gap-8 text-[13px] text-text-secondary mb-8">
          <a href="mailto:manrajwazir@gmail.com" className="hover:text-text-primary transition-colors">Contact</a>
          <a href="https://github.com/Manrajwazir/SiteIQ" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors">GitHub</a>
        </div>
        <p className="text-[12px] text-text-tertiary">
          &#169; 2026 All Clear. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

/* ---------- sub-components ---------- */

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] p-8 text-center hover:border-white/[0.1] transition-colors">
      <h3 className="text-[16px] font-medium mb-3">{title}</h3>
      <p className="text-[13px] text-text-secondary leading-relaxed">{description}</p>
    </div>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-[32px] sm:text-[40px] font-semibold tracking-tight leading-none" dangerouslySetInnerHTML={{ __html: value }} />
      <p className="mt-2 text-[13px] text-text-tertiary">{label}</p>
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <svg className="w-4 h-4 text-status-safe flex-shrink-0" viewBox="0 0 16 16" fill="none">
        <path d="M13.25 4.75L6 12 2.75 8.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
