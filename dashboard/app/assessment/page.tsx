import Band, { Card, Eyebrow } from "@/components/site/Band";
import PageHero from "@/components/site/PageHero";
import AssessmentRequestForm from "@/components/assessment/AssessmentRequestForm";

export const metadata = {
  title: "Request an assessment",
  description:
    "A fixed-fee safety risk assessment that produces a documented compliance baseline for your sites, and tells us what the ongoing agreement should cost for your operation.",
};

const DELIVERABLES = [
  [
    "A documented compliance baseline",
    "Where PPE compliance actually stands across the zones that matter, measured rather than estimated.",
  ],
  [
    "A camera and coverage map",
    "Which of your existing feeds are usable, which zones are uncovered, and how many edge units a site would need.",
  ],
  [
    "Your COR and WCB position",
    "Where the documentation gaps sit against what a COR audit asks for, and what that is worth against your rating.",
  ],
  [
    "A specific quote",
    "The assessment concludes with a real number for the ongoing agreement — not a range, and not negotiated later during deployment.",
  ],
];

export default function AssessmentPage() {
  return (
    <>
      <PageHero
        eyebrow="Request an assessment"
        title="Start with a documented baseline for one site."
        lead="A safety risk assessment is how an engagement begins. It is fixed-fee and time-boxed, it runs on your own sites, and it ends with a compliance baseline you keep regardless of whether you go further."
      />

      {/* ═══ What it is — cream-200 ════════════════════════════ */}
      <Band tone="cream-200">
        <div className="mb-10 max-w-[52ch]">
          <Eyebrow className="mb-6">What you get</Eyebrow>
          <h2 className="text-[clamp(26px,3.4vw,40px)] font-medium leading-[1.15] tracking-[-0.02em]">
            A baseline, a coverage map, and a number.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {DELIVERABLES.map(([title, body]) => (
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

      {/* ═══ The form + how pricing works — cream ══════════════ */}
      <Band tone="cream">
        <div className="grid grid-cols-1 items-start gap-y-14 lg:grid-cols-[1.25fr_1fr] lg:gap-x-24">
          <AssessmentRequestForm />

          <aside className="flex flex-col gap-4">
            <Card on="cream">
              <div className="label mb-3 text-accent">How pricing works</div>
              <p className="text-[15px] leading-[1.7] text-ink-muted">
                We start with the paid safety risk assessment — a fixed-fee
                engagement that produces a documented compliance baseline for
                your sites. From there it&rsquo;s equipment and setup upfront,
                then an annual subscription priced to your operation&rsquo;s
                size. We quote per site, because a six-camera shop and a
                fifty-camera plant aren&rsquo;t the same job.
              </p>
            </Card>
            <Card on="cream">
              <div className="label mb-3 text-accent">
                No imagery by default
              </div>
              <p className="text-[15px] leading-[1.7] text-ink-muted">
                Default mode stores structured events only. Snapshots are off
                unless you deliberately enable them, per site.
              </p>
            </Card>
            <Card on="cream">
              <div className="label mb-3 text-accent">Runs on your cameras</div>
              <p className="text-[15px] leading-[1.7] text-ink-muted">
                The assessment uses the feeds you already have. The only new
                equipment is one small edge computer per six to eight cameras,
                quoted separately and never bundled into the subscription.
              </p>
            </Card>
            <Card on="cream">
              <div className="label mb-3 text-accent">What happens next</div>
              <p className="text-[15px] leading-[1.7] text-ink-muted">
                A short call about your camera setup and the zones you need
                documented. We scope the assessment from there, and you get a
                fixed fee before anything starts.
              </p>
            </Card>
          </aside>
        </div>
      </Band>
    </>
  );
}
