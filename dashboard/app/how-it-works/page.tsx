import Band, { Card, Eyebrow } from "@/components/site/Band";
import PageHero from "@/components/site/PageHero";
import { PrimaryCTA } from "@/components/site/Buttons";

export const metadata = {
  title: "How it works",
  description:
    "Four stages from an existing camera feed to a compliance record: on-site inference, a structured entry with a confidence score, and a text to the supervisor who can act.",
};

const FIELDS = [
  ["Timestamp", "Local time, to the second"],
  ["Site and zone", "Named site and the zone it covers"],
  ["Camera", "Source camera identifier"],
  ["Event type", "Which PPE item was absent"],
  ["Confidence", "How certain the model was"],
  ["Alert", "Who was notified, and when"],
  ["Imagery", "None, unless snapshot mode is on"],
];

const CAPABILITIES = [
  [
    "Runs on the cameras you have",
    "Standard site security feeds. Deployment is a connection, not a construction project. No re-cabling, and no change to how the yard is monitored.",
  ],
  [
    "Inference stays on site",
    "Detection runs locally on a device on your property. In default mode video never leaves the site, and the records are held on Canadian infrastructure.",
  ],
  [
    "An alert to the person who can act",
    "The supervisor responsible for the area gets a text naming the site and zone. No dashboard to keep open, no app to install.",
  ],
  [
    "Audit-ready by default",
    "Every detection is a record. When a COR auditor or a WCB reviewer asks about a shift in March, there is something to open.",
  ],
];

const DEPLOYMENT = [
  [
    "A call about your cameras",
    "Which sites, which zones, what the existing feeds look like, and who should receive alerts.",
  ],
  [
    "The risk assessment",
    "A fixed-fee, time-boxed engagement that produces a documented compliance baseline, and tells us what the ongoing agreement should cost for your operation.",
  ],
  [
    "One site connected",
    "We install the edge device against the feeds for the first zone and confirm alerts land with the right supervisor.",
  ],
  [
    "The log starts filling",
    "Real records accumulate from your own site, not a demo dataset, and the compliance baseline starts building itself.",
  ],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="From an existing camera feed to a record that holds up."
        lead="One path, four stages. None of it requires a control room or someone watching a screen."
      />

      {/* ═══ Stages 1 & 2 — cream-200 ═══════════════════════════ */}
      <Band tone="cream-200">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <Stage
            label="Stage one · Input"
            title="The cameras already on site"
          >
            <p>
              All Clear reads the standard security feeds you already run. We
              point the system at the cameras covering the zones where PPE
              matters most: usually gates, laydown yards and active work fronts.
            </p>
            <p>
              What does get added is one small computer. It sits on your
              property, typically in the trailer, and it is the only new
              equipment involved. No new poles, no new cabling, and no change to
              your existing surveillance setup.
            </p>
          </Stage>

          <Stage
            label="Stage two · Detection"
            title="Inference on a local device"
          >
            <p>
              A computer-vision model runs on that device and evaluates frames
              as they arrive. It looks for a narrow, specific thing: a person in
              frame without a hard hat, without a hi-vis vest, or without a
              mask.
            </p>
            <p>
              Frames are evaluated and dropped. What continues down the pipeline
              is a description of an event, not the footage of it. It is not a
              productivity or behaviour-monitoring tool. It watches for a small set
              of safety conditions and nothing else.
            </p>
          </Stage>
        </div>
      </Band>

      {/* ═══ Stage 3 — the record — cream, card + data table ════ */}
      <Band tone="cream">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <Stage label="Stage three · Record" title="A structured compliance entry">
            <p>
              Each detection is written to the database as a row with fixed
              fields, so a period can be queried and exported rather than
              reconstructed. This is the part that gets shown to a COR auditor,
              an insurer, or a WCB reviewer.
            </p>
            <p>
              Tamper-evidence is being built into this record through our Labs4
              research placement this fall: each event is hash-chained to the
              one before it, so a record that is altered breaks the chain and
              the change is detectable. It is in development, and we will say so
              until it has been validated.
            </p>
          </Stage>

          <Card on="cream" className="p-0">
            <div className="label px-6 py-5 text-accent">
              Fields on every event
            </div>
            <dl className="grid grid-cols-1 gap-px bg-rule">
              {FIELDS.map(([term, detail]) => (
                <div
                  key={term}
                  className="flex flex-col gap-1 bg-cream-50 px-6 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                >
                  <dt className="label text-ink">{term}</dt>
                  <dd className="text-[14px] text-ink-muted sm:text-right">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </Band>

      {/* ═══ Stage 4 — navy ════════════════════════════════════ */}
      <Band tone="navy">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <Eyebrow inverse className="mb-6">
              Stage four · Alert
            </Eyebrow>
            <h2 className="text-[clamp(24px,3vw,34px)] font-medium leading-[1.2] tracking-[-0.02em]">
              A text message to the person who can act
            </h2>
            <div className="measure mt-6 space-y-4 text-[16px] leading-[1.7] text-ink-inverse/85 sm:text-[17px]">
              <p>
                The supervisor responsible for that area gets an SMS naming the
                site and the zone. There is no dashboard to keep open and no app
                to install, because the people who need this are outside, on
                radio, wearing gloves.
              </p>
              <p>
                Prevention is a real benefit and it comes along for free. But
                the record is what gets tested: by an auditor, by an insurer, or by
                an investigation months later.
              </p>
            </div>
          </div>

          <div>
            <Eyebrow inverse className="mb-6">
              Modes
            </Eyebrow>
            <h2 className="text-[clamp(24px,3vw,34px)] font-medium leading-[1.2] tracking-[-0.02em]">
              Default mode keeps no imagery at all.
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-4">
              <Card on="navy">
                <div className="label mb-3 text-accent-on-navy">
                  Default mode
                </div>
                <p className="text-[15px] leading-[1.7] text-ink-inverse/85">
                  Frames are analyzed on site and discarded. Only the structured
                  event is stored. No stills, no clips, no cloud storage of
                  imagery.
                </p>
                <p className="mt-3 text-[13px] leading-[1.8] text-ink-inverse-muted">
                  Camera &rarr; local inference &rarr; event record &rarr; SMS
                </p>
              </Card>
              <Card on="navy">
                <div className="label mb-3 text-accent-on-navy">
                  Snapshot mode · opt in
                </div>
                <p className="text-[15px] leading-[1.7] text-ink-inverse/85">
                  If your incident process needs a still attached to an event,
                  snapshot mode can be enabled per site. It is off until you
                  turn it on, and it is the only path where an image is
                  retained.
                </p>
                <p className="mt-3 text-[13px] leading-[1.8] text-ink-inverse-muted">
                  Camera &rarr; local inference &rarr; stored snapshot + event
                  record &rarr; SMS
                </p>
              </Card>
            </div>
          </div>
        </div>
      </Band>

      {/* ═══ What it does — cream ══════════════════════════════ */}
      <Band tone="cream">
        <Eyebrow className="mb-6">What it does</Eyebrow>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {CAPABILITIES.map(([title, body]) => (
            <Card key={title} on="cream">
              <h3 className="mb-3 text-[18px] font-medium tracking-[-0.01em]">
                {title}
              </h3>
              <p className="text-[15px] leading-[1.65] text-ink-muted">
                {body}
              </p>
            </Card>
          ))}
        </div>
      </Band>

      {/* ═══ Deployment — cream-200 ════════════════════════════ */}
      <Band tone="cream-200">
        <div className="mb-10 max-w-[46ch]">
          <Eyebrow className="mb-6">Getting started</Eyebrow>
          <h2 className="text-[clamp(26px,3.4vw,40px)] font-medium leading-[1.15] tracking-[-0.02em]">
            What deployment actually looks like.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {DEPLOYMENT.map(([title, body]) => (
            <Card key={title} on="cream-200">
              <h3 className="mb-3 text-[18px] font-medium tracking-[-0.01em]">
                {title}
              </h3>
              <p className="text-[15px] leading-[1.65] text-ink-muted">
                {body}
              </p>
            </Card>
          ))}
        </div>
      </Band>

      <Band tone="navy" size="loose">
        <div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-9">
          <h2 className="max-w-[20ch] text-[clamp(28px,4vw,46px)] font-medium leading-[1.1] tracking-[-0.025em]">
            Point it at one camera and see the first record.
          </h2>
          <PrimaryCTA inverse href="/assessment" className="whitespace-nowrap">
            Request an assessment
          </PrimaryCTA>
        </div>
      </Band>
    </>
  );
}

function Stage({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Eyebrow className="mb-6">{label}</Eyebrow>
      <h2 className="text-[clamp(24px,3vw,34px)] font-medium leading-[1.2] tracking-[-0.02em]">
        {title}
      </h2>
      <div className="measure mt-6 space-y-4 text-[16px] leading-[1.7] text-ink-muted sm:text-[17px]">
        {children}
      </div>
    </div>
  );
}
