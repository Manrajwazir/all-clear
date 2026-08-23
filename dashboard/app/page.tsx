import Container from "@/components/site/Container";
import { Band, RailSection } from "@/components/site/Rail";
import { SolidCTA, OutlineCTA, ArrowLink } from "@/components/site/Buttons";
import { HairlineGrid, HairlineCell } from "@/components/site/Hairline";

export const metadata = {
  title: "All Clear — PPE compliance recording for Alberta sites",
  description:
    "All Clear watches the cameras already on your worksite, detects a missing hard hat or hi-vis vest, and writes each one to a timestamped compliance record.",
};

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <Container className="pb-[clamp(48px,7.5vw,88px)] pt-[clamp(56px,9vw,104px)]">
        <div className="mb-9 font-mono text-[11px] uppercase tracking-[0.16em] text-slate sm:mb-10">
          PPE compliance recording &nbsp;/&nbsp; Alberta industrial sites
        </div>
        <h1 className="max-w-[19ch] text-[clamp(34px,6.2vw,68px)] font-medium leading-[1.03] tracking-[-0.025em]">
          Every PPE check on your site, documented the moment it happens.
        </h1>

        <div className="mt-10 grid grid-cols-1 items-start gap-y-8 lg:mt-11 lg:grid-cols-2 lg:gap-x-16">
          <p className="text-[17px] font-light leading-[1.6] text-slate sm:text-[19px]">
            All Clear watches the security cameras already on your worksite,
            detects a missing hard hat or hi-vis vest, and writes each one to a
            timestamped compliance record. The audit trail builds itself,
            instead of being reconstructed from clipboards after the fact.
          </p>
          <div className="flex flex-col gap-5 lg:pt-1.5">
            <div className="flex flex-wrap gap-4">
              <SolidCTA href="/contact">Request a pilot</SolidCTA>
              <OutlineCTA href="/how-it-works">How it works</OutlineCTA>
            </div>
            <p className="font-mono text-[11px] leading-[1.9] tracking-[0.06em] text-slate">
              No credit card. No new cameras. A live demo runs on your own feeds.
            </p>
          </div>
        </div>
      </Container>

      {/* ── 01 The gap ───────────────────────────────────────── */}
      <Band>
        <RailSection
          label={<>01 &nbsp;/&nbsp; The gap</>}
          className="py-[clamp(44px,7vw,76px)]"
        >
          <div className="max-w-[70ch]">
            <h2 className="mb-6 text-[clamp(24px,3.2vw,34px)] font-normal leading-[1.2] tracking-[-0.015em]">
              Compliance work already happens. The record of it usually
              doesn&rsquo;t.
            </h2>
            <p className="mb-4 text-[17px] font-light leading-[1.65] text-slate">
              Alberta operators have to demonstrate safety compliance to
              auditors, to insurers and WCB reviewers, and to an investigation
              after an incident. Most demonstrate it by hand: spot checks,
              walkarounds, a clipboard signed at shift start.
            </p>
            <p className="text-[17px] font-light leading-[1.65] text-slate">
              Which means the paper trail is thinnest exactly when someone tests
              it: months later, for a specific hour, on a specific part of the
              yard.
            </p>
          </div>
        </RailSection>
      </Band>

      {/* ── 02 Pipeline ──────────────────────────────────────── */}
      <Band>
        <Container className="py-[clamp(44px,7vw,76px)]">
          <div className="mb-10 grid grid-cols-1 gap-y-3.5 lg:mb-[60px] lg:grid-cols-[200px_1fr] lg:gap-x-14">
            <div className="label-mono text-slate">02 &nbsp;/&nbsp; Pipeline</div>
            <h2 className="max-w-[22ch] text-[clamp(24px,3.2vw,34px)] font-normal leading-[1.2] tracking-[-0.015em]">
              Three steps, one of which is a camera you already own.
            </h2>
          </div>

          <div className="relative border-t border-rule-strong">
            {/* Decorative marker tracing the pipeline left to right. */}
            <span
              aria-hidden="true"
              className="animate-ac-run absolute -top-1 left-0 hidden h-[7px] w-[7px] bg-navy lg:block"
            />
            <div className="grid grid-cols-1 lg:grid-cols-3">
              <PipelineStep
                step="01"
                title="Existing camera"
                className="border-b border-rule lg:border-b-0 lg:border-r lg:pr-8"
              >
                The feed comes off the cameras already mounted on your site.
                Nothing new goes up on the pole.
              </PipelineStep>
              <PipelineStep
                step="02"
                title="On-site detection"
                className="border-b border-rule lg:border-b-0 lg:border-r lg:px-8"
              >
                Frames are analyzed on a local device and discarded. A missing
                hard hat or vest becomes a structured event, not a picture.
              </PipelineStep>
              <PipelineStep step="03" title="Record and alert" className="lg:pl-8">
                The event is written to the compliance log and the supervisor
                gets an SMS in under a minute.
              </PipelineStep>
            </div>
          </div>

          <div className="mt-10 lg:mt-11">
            <ArrowLink href="/how-it-works">Read the full pipeline</ArrowLink>
          </div>
        </Container>
      </Band>

      {/* ── 03 The record ────────────────────────────────────── */}
      <Band>
        <RailSection
          label={<>03 &nbsp;/&nbsp; The record</>}
          className="py-[clamp(44px,7vw,76px)]"
        >
          <h2 className="mb-3 max-w-[24ch] text-[clamp(24px,3.2vw,34px)] font-normal leading-[1.2] tracking-[-0.015em]">
            The detection isn&rsquo;t the product. This is.
          </h2>
          <p className="mb-10 max-w-[62ch] text-[17px] font-light leading-[1.65] text-slate">
            Each event is stored as a structured, timestamped entry: queryable
            by site, camera, date range and violation type, and exportable when
            an auditor asks for a period.
          </p>

          <div className="border border-rule-strong bg-cream-wash">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-rule px-6 py-4">
              <span className="label-mono text-navy">Compliance event</span>
              <span className="font-mono text-[11px] tracking-[0.1em] text-slate">
                REC-000418
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3">
              <RecordField
                label="Timestamp"
                value="09:41:07 MDT"
                className="border-b border-rule-soft lg:border-r"
              />
              <RecordField
                label="Site"
                value="Yard 4 · North gate"
                className="border-b border-rule-soft lg:border-r"
              />
              <RecordField
                label="Camera"
                value="CAM-07"
                className="border-b border-rule-soft"
              />
              <RecordField
                label="Event"
                value="Hard hat not detected"
                className="border-b border-rule-soft lg:border-b-0 lg:border-r"
              />
              <RecordField
                label="Alert"
                value="SMS → supervisor"
                className="border-b border-rule-soft lg:border-b-0 lg:border-r"
              />
              <RecordField label="Imagery retained" value="None · default mode" />
            </div>
          </div>
          <p className="mt-3.5 font-mono text-[11px] tracking-[0.06em] text-slate">
            Illustrative example. Not a real record.
          </p>
        </RailSection>
      </Band>

      {/* ── 04 Privacy ───────────────────────────────────────── */}
      <Band inverse>
        <RailSection
          label={<>04 &nbsp;/&nbsp; Privacy</>}
          inverse
          className="py-[clamp(52px,8vw,96px)]"
        >
          <h2 className="mb-7 max-w-[20ch] text-[clamp(28px,4.4vw,46px)] font-normal leading-[1.1] tracking-[-0.02em]">
            A sensor, not a camera.
          </h2>
          <p className="mb-11 max-w-[62ch] text-[17px] font-light leading-[1.65] text-cream/80 sm:text-[18px]">
            In default mode All Clear captures zero imagery. No stills, no
            clips, no faces. Only the structured event: what was missing, where,
            and when. Nothing to leak, nothing to subpoena, nothing to hand a
            supervisor as a photograph of a worker.
          </p>

          <div className="grid grid-cols-1 border-t border-rule-inverse lg:grid-cols-2">
            <div className="border-b border-rule-inverse-soft py-7 lg:border-b-0 lg:border-r lg:pr-8">
              <div className="label-mono mb-3 text-slate-light">Default</div>
              <p className="text-[15px] font-light leading-[1.65] text-cream/80">
                Structured events only. Frames are processed on site and
                discarded immediately.
              </p>
            </div>
            <div className="py-7 lg:pl-8">
              <div className="label-mono mb-3 text-slate-light">Opt-in</div>
              <p className="text-[15px] font-light leading-[1.65] text-cream/80">
                If your investigation process needs a snapshot attached to an
                event, you turn that on deliberately, per site.
              </p>
            </div>
          </div>

          <p className="mt-9 max-w-[60ch] text-[15px] font-light leading-[1.7] text-slate-light">
            On a unionized industrial site, &ldquo;we are not filming you&rdquo;
            is not a footnote. It is usually the first question asked in the
            room.
          </p>
        </RailSection>
      </Band>

      {/* ── 05 What it does ──────────────────────────────────── */}
      <Band>
        <RailSection
          label={<>05 &nbsp;/&nbsp; What it does</>}
          className="py-[clamp(44px,7vw,76px)]"
        >
          <HairlineGrid>
            <HairlineCell>
              <h3 className="mb-2.5 text-[19px] font-medium tracking-[-0.01em]">
                Runs on the cameras you have
              </h3>
              <p className="text-[15px] font-light leading-[1.65] text-slate">
                Standard site security feeds. No new hardware to mount, no
                re-cabling, no change to how the yard is monitored.
              </p>
            </HairlineCell>
            <HairlineCell>
              <h3 className="mb-2.5 text-[19px] font-medium tracking-[-0.01em]">
                Inference stays on site
              </h3>
              <p className="text-[15px] font-light leading-[1.65] text-slate">
                Detection runs locally on a device in the trailer. Video never
                leaves the property in default mode.
              </p>
            </HairlineCell>
            <HairlineCell>
              <h3 className="mb-2.5 text-[19px] font-medium tracking-[-0.01em]">
                Sub-minute SMS alerts
              </h3>
              <p className="text-[15px] font-light leading-[1.65] text-slate">
                The supervisor gets a text, not a dashboard notification. No app
                to install, nothing to sit and watch.
              </p>
            </HairlineCell>
            <HairlineCell>
              <h3 className="mb-2.5 text-[19px] font-medium tracking-[-0.01em]">
                Audit-ready by default
              </h3>
              <p className="text-[15px] font-light leading-[1.65] text-slate">
                Every detection is a record. When a reviewer asks about a shift
                in March, there is something to open.
              </p>
            </HairlineCell>
          </HairlineGrid>
        </RailSection>
      </Band>

      {/* ── 06 Supported by ──────────────────────────────────── */}
      <Band>
        <RailSection
          label={<>06 &nbsp;/&nbsp; Supported by</>}
          className="py-[clamp(36px,6vw,64px)]"
        >
          <div className="flex flex-wrap items-baseline gap-x-11 gap-y-3.5">
            {[
              "Edmonton Unlimited",
              "Alberta Innovates",
              "City of Edmonton",
              "NAIT Centre for Sensors and System Integration",
            ].map((name) => (
              <span
                key={name}
                className="text-[17px] font-medium tracking-[0.02em]"
              >
                {name}
              </span>
            ))}
            <span className="font-mono text-[11px] tracking-[0.1em] text-slate">
              Mitacs Labs4 research placement
            </span>
          </div>
        </RailSection>
      </Band>

      {/* ── 07 Pricing ───────────────────────────────────────── */}
      <Band>
        <RailSection
          label={<>07 &nbsp;/&nbsp; Pricing</>}
          className="py-[clamp(44px,7vw,76px)]"
        >
          <div className="max-w-[64ch]">
            <h2 className="mb-5 text-[clamp(24px,3.2vw,34px)] font-normal leading-[1.2] tracking-[-0.015em]">
              Quoted per site, after a short call.
            </h2>
            <p className="mb-7 text-[17px] font-light leading-[1.65] text-slate">
              Coverage depends on how many cameras a site runs and which zones
              you need documented, so we scope it with you rather than
              publishing a number that won&rsquo;t match your yard. Pilots start
              at no cost and no commitment.
            </p>
            <ArrowLink href="/contact">Request pricing</ArrowLink>
          </div>
        </RailSection>
      </Band>

      {/* ── Closing CTA ──────────────────────────────────────── */}
      <Band>
        <Container className="flex flex-wrap items-end justify-between gap-x-14 gap-y-9 py-[clamp(56px,9vw,104px)]">
          <h2 className="max-w-[22ch] text-[clamp(28px,4.2vw,44px)] font-normal leading-[1.1] tracking-[-0.02em]">
            Run it on one site and see what the log looks like.
          </h2>
          <SolidCTA href="/contact" className="whitespace-nowrap">
            Request a pilot
          </SolidCTA>
        </Container>
      </Band>
    </>
  );
}

/* ── local pieces ───────────────────────────────────────────── */

function PipelineStep({
  step,
  title,
  className,
  children,
}: {
  step: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`py-7 ${className ?? ""}`}>
      <div className="mb-3.5 font-mono text-[11px] tracking-[0.14em] text-slate">
        STEP {step}
      </div>
      <h3 className="mb-3 text-[21px] font-medium tracking-[-0.01em]">
        {title}
      </h3>
      <p className="text-[15px] font-light leading-[1.65] text-slate">
        {children}
      </p>
    </div>
  );
}

function RecordField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`px-6 py-5 ${className ?? ""}`}>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate">
        {label}
      </div>
      <div className="font-mono text-[15px] text-navy">{value}</div>
    </div>
  );
}
