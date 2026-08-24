import Band, { Card, Eyebrow } from "@/components/site/Band";
import { PrimaryCTA, SecondaryCTA, ArrowLink } from "@/components/site/Buttons";


export const metadata = {
  title: "All Clear | Monitoring system for safety in worksites",
  description:
    "Get AI-Driven risk assessment for your worksite. Discover cost drivers, hazards, and get the documentation certificate of recognition(COR) to what your WCB standing depends on.",
};

export default function HomePage() {
  return (
    <>
      {/* ═══ 1. Hero — cream base ═══════════════════════════════ */}
      <Band tone="cream" size="loose" reveal={false}>
        <Eyebrow className="mb-8">
          Monitoring system for safety in&nbsp;·&nbsp; worksites
        </Eyebrow>

        <div className="grid grid-cols-1 items-end gap-y-10 lg:grid-cols-[1.15fr_1fr] lg:gap-x-20">
          <h1 className="text-[clamp(38px,6.4vw,76px)] font-medium leading-[1.02] tracking-[-0.03em]">
            Safety you can see. Proof you can trust.
          </h1>

          <div className="lg:pb-2">
            <p className="text-[17px] leading-[1.65] text-ink-muted sm:text-[19px]">
              All Clear is a monitoring system that is added to security cameras already on your site, 
              and writes each one to a
              timestamped compliance record. That record is what a COR audit
              asks for, and what your WCB standing rests on.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <PrimaryCTA href="/assessment">Request an assessment</PrimaryCTA>
              <SecondaryCTA href="/how-it-works">How it works</SecondaryCTA>
            </div>
          </div>
        </div>
      </Band>

      {/* ═══ 2. The financial mechanism — cream-200 band ════════ */}
      <Band tone="cream-200">
        <div className="grid grid-cols-1 gap-y-10 lg:grid-cols-[1fr_1fr] lg:gap-x-20">
          <div>
            <Eyebrow className="mb-6">The product</Eyebrow>
            <h2 className="text-[clamp(26px,3.4vw,40px)] font-medium leading-[1.15] tracking-[-0.02em]">
              Most operators run safe sites. Few can prove it.
            </h2>
            <div className="measure mt-6 space-y-4 text-[16px] leading-[1.7] text-ink-muted sm:text-[17px]">
              <p>
                In Alberta, safety performance shows up on the balance sheet.
                Every operator pays a WCB premium, and that premium moves on
                claims history and on whether the company can produce audited
                proof that a safety system is genuinely in place. COR
                certification requires that proof. The PIR rebate requires COR.
              </p>
              <p>
                So the documentation is the gate. Operators who cannot produce
                it pay more and forfeit rebates they would otherwise qualify
                for. Under Alberta&rsquo;s strict-liability OHS regime the
                burden also sits with the employer to show due diligence using
                records made <em>before</em> an incident, not reconstructed
                after one.
              </p>
            </div>
          </div>

          {/* Stat pair — cards, not a bordered table */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:content-start">
            <Card on="cream-200">
              <div className="tabular text-[clamp(34px,4vw,48px)] font-medium leading-none tracking-[-0.02em] text-accent">
                $106.5M
              </div>
              <p className="mt-4 text-[15px] leading-[1.6] text-ink-muted">
                Paid out by WCB-Alberta in PIR rebates in a single year, to over
                10,000 COR holders.
              </p>
            </Card>
            <Card on="cream-200">
              <div className="tabular text-[clamp(34px,4vw,48px)] font-medium leading-none tracking-[-0.02em] text-accent">
                Up&nbsp;to&nbsp;20%
              </div>
              <p className="mt-4 text-[15px] leading-[1.6] text-ink-muted">
                Off the industry rate through PIR. Gated on holding a COR and on
                improving performance, not on paperwork alone.
              </p>
            </Card>
          </div>
        </div>
      </Band>

      {/* ═══ 3. How it works — cream, cards on the lighter tone ══ */}
      <Band tone="cream">
        <div className="mb-10 max-w-[46ch]">
          <Eyebrow className="mb-6">How it works</Eyebrow>
          <h2 className="text-[clamp(26px,3.4vw,40px)] font-medium leading-[1.15] tracking-[-0.02em]">
            Three steps, one of which is a camera you already own.
          </h2>
        </div>

        {/* The travelling marker reads across the three cards. */}
        <div className="relative">
          <span
            aria-hidden="true"
            className="animate-ac-run absolute -top-3 left-0 hidden h-[7px] w-[7px] rounded-soft bg-accent lg:block"
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
            <Step
              label="Existing cameras"
              title="The feed you already run"
              body="All Clear reads the standard security cameras covering the zones where PPE matters: gates, laydown yards, active work fronts. No rip-and-replace."
            />
            <Step
              label="On-site inference"
              title="A small computer in the trailer"
              body="A model runs on hardware sitting on your property and evaluates frames as they arrive, looking for a person without a hard hat, hi-vis vest or mask. Frames are evaluated and dropped."
            />
            <Step
              label="Record and alert"
              title="A structured compliance entry"
              body="Each detection is written to the log with its timestamp, site and zone, camera, event type and confidence score. The supervisor responsible for that area gets a text."
            />
          </div>
        </div>

        <div className="mt-10">
          <ArrowLink href="/how-it-works">Read the full pipeline</ArrowLink>
        </div>
      </Band>

      {/* ═══ 4. Sensor, not camera + the record — navy band ═════ */}
      <Band tone="navy" size="loose">
        <div className="grid grid-cols-1 gap-y-14 lg:grid-cols-[1fr_1fr] lg:gap-x-20">
          <div>
            <Eyebrow inverse className="mb-6">
              A sensor, not a camera
            </Eyebrow>
            <h2 className="text-[clamp(28px,3.8vw,46px)] font-medium leading-[1.1] tracking-[-0.025em]">
              In default mode, nothing is filmed.
            </h2>
            <div className="measure mt-6 space-y-4 text-[16px] leading-[1.7] text-ink-inverse/85 sm:text-[17px]">
              <p>
                Default mode captures no imagery. No stills, no clips, no faces.
                Only the structured event: what was missing, where, and when.
                Detection runs on site and video never leaves the property.
              </p>
              <p>
                On a unionized industrial site, &ldquo;we are not filming
                you&rdquo; is not a footnote. It is usually the first question
                asked in the room. Snapshot mode exists for operators whose
                incident process needs a still attached to an event. It is off
                until you deliberately turn it on, per site, and it is the only
                configuration where an image is kept.
              </p>
              <p>
                Records are held in Canada, on Canadian infrastructure.
              </p>
            </div>
            <div className="mt-8">
              <ArrowLink inverse href="/privacy">
                Read the privacy policy
              </ArrowLink>
            </div>
          </div>

          {/* The record itself — a navy-700 card, no borders */}
          <div>
            <Card on="navy" className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-5">
                <span className="label text-accent-on-navy">
                  Compliance event
                </span>
                <span className="tabular text-[13px] text-ink-inverse-muted">
                  REC-000418
                </span>
              </div>
              <dl className="grid grid-cols-1 gap-px bg-rule-inverse sm:grid-cols-2">
                <Field label="Timestamp" value="09:41:07 MDT" />
                <Field label="Site" value="Yard 4 · North gate" />
                <Field label="Camera" value="CAM-07" />
                <Field label="Event" value="Hard hat not detected" />
                <Field label="Confidence" value="0.94" />
                <Field label="Imagery retained" value="None · default mode" />
              </dl>
            </Card>
            <p className="mt-4 text-[13px] text-ink-inverse-muted">
              Illustrative example. Not a real record.
            </p>
          </div>
        </div>
      </Band>

      {/* ═══ 5. Proof, backing, and the close — cream-200 ═══════ */}
      <Band tone="cream-200">
        <div className="grid grid-cols-1 gap-y-12 lg:grid-cols-[1fr_1fr] lg:gap-x-20">
          <div>
            <Eyebrow className="mb-6">Where we are</Eyebrow>
            <h2 className="text-[clamp(24px,3vw,34px)] font-medium leading-[1.2] tracking-[-0.02em]">
              Being validated in the open, not sold on a promise.
            </h2>
            <div className="measure mt-6 space-y-4 text-[16px] leading-[1.7] text-ink-muted sm:text-[17px]">
              <p>
                All Clear is built in Edmonton and being developed through a
                Mitacs Labs4 research placement with NAIT&rsquo;s Centre for
                Sensors and System Integration, which means the detection work
                is evaluated under academic supervision rather than only by the
                people who wrote it.
              </p>
              <p>
                Tamper-evidence is part of that placement. Each event is
                hash-chained to the one before it, so a modified record breaks
                the chain and is detectable. That mechanism is being implemented
                and validated this fall, and we describe it as in development
                because that is what it is.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {[
                "Edmonton Unlimited",
                "Alberta Innovates",
                "City of Edmonton",
                "NAIT",
              ].map((name) => (
                <span key={name} className="text-[16px] font-medium">
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Carried as a card so the column has weight of its own rather
              than trailing off into empty band. */}
          <Card on="cream-200" className="flex flex-col p-8 sm:p-10">
            <Eyebrow className="mb-6">Engagement</Eyebrow>
            <h2 className="text-[clamp(24px,3vw,34px)] font-medium leading-[1.2] tracking-[-0.02em]">
              It starts with a paid risk assessment.
            </h2>
            <p className="mt-6 text-[16px] leading-[1.7] text-ink-muted sm:text-[17px]">
              A fixed-fee engagement that produces a documented compliance
              baseline for your sites. From there it&rsquo;s equipment and setup
              upfront, then an annual subscription priced to your
              operation&rsquo;s size. We quote per site, because a six-camera
              shop and a fifty-camera plant aren&rsquo;t the same job.
            </p>
            <div className="mt-auto pt-8">
              <ArrowLink href="/assessment">What the assessment covers</ArrowLink>
            </div>
          </Card>
        </div>
      </Band>

      {/* ═══ Closing CTA — navy-900, straight into the footer ═══ */}
      <Band tone="navy" size="loose">
        <div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-9">
          <h2 className="max-w-[20ch] text-[clamp(28px,4vw,46px)] font-medium leading-[1.1] tracking-[-0.025em]">
            Start with one site. See what your safety record looks like.
          </h2>
          <PrimaryCTA inverse href="/assessment" className="whitespace-nowrap">
            Request an assessment
          </PrimaryCTA>
        </div>
      </Band>
    </>
  );
}

/* ── local pieces ───────────────────────────────────────────── */

function Step({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <Card on="cream" className="flex flex-col">
      <div className="label mb-5 text-accent">{label}</div>
      <h3 className="mb-3 text-[20px] font-medium tracking-[-0.01em]">
        {title}
      </h3>
      <p className="text-[15px] leading-[1.65] text-ink-muted">{body}</p>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-navy-700 px-6 py-5">
      <dt className="label mb-2 text-ink-inverse-muted">{label}</dt>
      <dd className="tabular text-[15px] text-ink-inverse">{value}</dd>
    </div>
  );
}
