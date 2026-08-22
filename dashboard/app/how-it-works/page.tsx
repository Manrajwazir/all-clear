import Container from "@/components/site/Container";
import PageHero from "@/components/site/PageHero";
import { Band, RailSection } from "@/components/site/Rail";
import { SolidCTA } from "@/components/site/Buttons";
import { HairlineGrid, HairlineCell } from "@/components/site/Hairline";

export const metadata = {
  title: "How it works",
  description:
    "Four stages from an existing camera feed to a compliance record: on-site inference, a structured entry, and an SMS to the supervisor who can act.",
};

const FIELDS = [
  ["Timestamp", "Local time, to the second"],
  ["Site", "Named site and zone"],
  ["Camera", "Source camera ID"],
  ["Event type", "Which PPE item was absent"],
  ["Alert", "Who was notified, and when"],
  ["Imagery", "None, unless snapshot mode is on"],
];

const DEPLOYMENT = [
  [
    "01",
    "A call about your cameras",
    "Which sites, which zones, what the existing feeds look like, who should receive alerts.",
  ],
  [
    "02",
    "One site connected",
    "We connect a device to the feeds for the pilot zone and confirm alerts land with the right supervisor.",
  ],
  [
    "03",
    "The log starts filling",
    "You watch a week of real records accumulate from your own site, not a demo dataset.",
  ],
  [
    "04",
    "Decide from there",
    "Expand to more zones and sites, or don't. The pilot has no commitment attached to it.",
  ],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="From an existing camera feed to a record that holds up."
        lead="The whole system is one path with four stages. Nothing about it requires a new camera, a control room, or someone watching a screen."
      />

      {/* ── The four stages ──────────────────────────────────── */}
      <Band>
        <Container className="py-[clamp(40px,6.5vw,72px)]">
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] lg:gap-x-14">
            {/* Vertical track with its travelling marker — desktop only. */}
            <div
              aria-hidden="true"
              className="relative hidden border-l border-rule-strong lg:block"
            >
              <span className="animate-ac-drop absolute -left-1 top-0 h-[7px] w-[7px] bg-navy" />
            </div>

            <div className="flex min-w-0 flex-col">
              <Stage
                index="Stage 01"
                kind="Input"
                title="The cameras already on site"
                className="pb-11"
              >
                <p className="mb-3.5 max-w-[66ch] text-[17px] font-light leading-[1.65] text-slate">
                  All Clear reads the standard security feeds you already run.
                  Deployment is a connection, not a construction project: we
                  point the system at the cameras covering the zones where PPE
                  matters most, usually gates, laydown yards and active work
                  fronts.
                </p>
                <p className="max-w-[66ch] font-mono text-[12px] leading-[1.9] tracking-[0.04em] text-slate">
                  No new poles. No new wiring. No change to your existing
                  surveillance setup.
                </p>
              </Stage>

              <Stage
                index="Stage 02"
                kind="Detection"
                title="Inference on a local device"
                className="border-t border-rule-soft py-[clamp(28px,5vw,48px)]"
              >
                <p className="mb-3.5 max-w-[66ch] text-[17px] font-light leading-[1.65] text-slate">
                  A computer-vision model runs on hardware sitting on your
                  property and evaluates frames as they arrive. It is looking
                  for a specific, narrow thing: a person in frame without a hard
                  hat, or without a hi-vis vest.
                </p>
                <p className="max-w-[66ch] text-[17px] font-light leading-[1.65] text-slate">
                  Frames are evaluated and dropped. What continues down the
                  pipeline is a description of an event, not the footage of it.
                </p>
              </Stage>

              <Stage
                index="Stage 03"
                kind="Record"
                title="A structured compliance entry"
                className="border-t border-rule-soft py-[clamp(28px,5vw,48px)]"
              >
                <p className="mb-7 max-w-[66ch] text-[17px] font-light leading-[1.65] text-slate">
                  Each detection is written to a database as a row with fixed
                  fields, so a period can be queried and exported rather than
                  reconstructed. This is the part that gets shown to an auditor,
                  an insurer, or a WCB reviewer.
                </p>

                <div className="max-w-[640px] border border-rule-strong bg-cream-wash">
                  <div className="label-mono border-b border-rule px-5 py-3.5">
                    Fields on every event
                  </div>
                  <dl className="flex flex-col">
                    {FIELDS.map(([term, detail], i) => (
                      <div
                        key={term}
                        className={`flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 ${
                          i < FIELDS.length - 1
                            ? "border-b border-rule-soft"
                            : ""
                        }`}
                      >
                        <dt className="font-mono text-[12px] uppercase tracking-[0.1em] text-slate">
                          {term}
                        </dt>
                        <dd className="font-mono text-[13px] sm:text-right">
                          {detail}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Stage>

              <Stage
                index="Stage 04"
                kind="Alert"
                title="A text message to the person who can act"
                className="border-t border-rule-soft pt-[clamp(28px,5vw,48px)]"
              >
                <p className="max-w-[66ch] text-[17px] font-light leading-[1.65] text-slate">
                  The supervisor responsible for that area gets an SMS in under
                  a minute, naming the site and the zone. There is no dashboard
                  to keep open and no app to install, because the people who
                  need this are outside, on radio, wearing gloves.
                </p>
              </Stage>
            </div>
          </div>
        </Container>
      </Band>

      {/* ── Modes ────────────────────────────────────────────── */}
      <Band inverse>
        <RailSection
          label="Modes"
          inverse
          className="py-[clamp(48px,7.5vw,88px)]"
        >
          <h2 className="mb-6 max-w-[22ch] text-[clamp(26px,3.6vw,38px)] font-normal leading-[1.12] tracking-[-0.02em]">
            Default mode keeps no imagery at all.
          </h2>
          <p className="mb-10 max-w-[64ch] text-[17px] font-light leading-[1.65] text-cream/80">
            This is the setting a site runs on unless someone deliberately
            changes it. It exists because the objection we hear first on an
            industrial site is not about accuracy. It is about being
            photographed at work.
          </p>

          <div className="grid grid-cols-1 border-t border-rule-inverse lg:grid-cols-2">
            <div className="border-b border-rule-inverse-soft py-7 lg:border-b-0 lg:border-r lg:pr-8">
              <div className="label-mono mb-3 text-slate-light">
                Default mode
              </div>
              <p className="mb-3 text-[15px] font-light leading-[1.7] text-cream/85">
                Frames are analyzed on site and discarded. Only the structured
                event is stored. No stills, no clips, no cloud storage of
                imagery.
              </p>
              <p className="font-mono text-[11px] leading-[1.9] tracking-[0.06em] text-slate-light">
                Camera &rarr; local inference &rarr; event record &rarr; SMS
              </p>
            </div>
            <div className="py-7 lg:pl-8">
              <div className="label-mono mb-3 text-slate-light">
                Snapshot mode &mdash; opt in
              </div>
              <p className="mb-3 text-[15px] font-light leading-[1.7] text-cream/85">
                If your incident process needs a still attached to an event,
                snapshot mode can be enabled per site. It is off until you turn
                it on, and it is the only path where an image is retained.
              </p>
              <p className="font-mono text-[11px] leading-[1.9] tracking-[0.06em] text-slate-light">
                Camera &rarr; local inference &rarr; stored snapshot + event
                record &rarr; SMS
              </p>
            </div>
          </div>
        </RailSection>
      </Band>

      {/* ── Deployment ───────────────────────────────────────── */}
      <Band>
        <RailSection
          label="Deployment"
          className="py-[clamp(40px,6.5vw,72px)]"
        >
          <HairlineGrid>
            {DEPLOYMENT.map(([num, title, body]) => (
              <HairlineCell key={num}>
                <div className="label-mono mb-3 text-slate">{num}</div>
                <h3 className="mb-2.5 text-[19px] font-medium">{title}</h3>
                <p className="text-[15px] font-light leading-[1.65] text-slate">
                  {body}
                </p>
              </HairlineCell>
            ))}
          </HairlineGrid>
        </RailSection>
      </Band>

      {/* ── Closing CTA ──────────────────────────────────────── */}
      <Band>
        <Container className="flex flex-wrap items-end justify-between gap-x-14 gap-y-9 py-[clamp(52px,8vw,96px)]">
          <h2 className="max-w-[22ch] text-[clamp(27px,4vw,42px)] font-normal leading-[1.1] tracking-[-0.02em]">
            Point it at one camera and see the first record.
          </h2>
          <SolidCTA href="/contact" className="whitespace-nowrap">
            Request a pilot
          </SolidCTA>
        </Container>
      </Band>
    </>
  );
}

function Stage({
  index,
  kind,
  title,
  className,
  children,
}: {
  index: string;
  kind: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="label-mono mb-3.5 text-slate">
        {index} &nbsp;&middot;&nbsp; {kind}
      </div>
      <h2 className="mb-3.5 text-[24px] font-medium tracking-[-0.015em] sm:text-[28px]">
        {title}
      </h2>
      {children}
    </section>
  );
}
