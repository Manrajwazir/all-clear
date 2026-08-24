import Band, { Card } from "@/components/site/Band";
import PageHero from "@/components/site/PageHero";
import AssessmentRequestForm from "@/components/assessment/AssessmentRequestForm";

export const metadata = {
  title: "Request an assessment",
  description:
    "A fixed-fee safety risk assessment that produces a documented compliance baseline for your sites, and tells us what the ongoing agreement should cost for your operation.",
};

export default function AssessmentPage() {
  return (
    <>
      <PageHero
        eyebrow="Request an assessment"
        title="Start with a documented baseline for one site."
        lead="A safety risk assessment is how an engagement begins. It is fixed-fee and time-boxed, it runs on your own sites, and it produces a documented compliance baseline for them."
      />

      {/* ═══ The form + how pricing works — cream-200 ═════════ */}
      <Band tone="cream-200">
        <div className="grid grid-cols-1 items-start gap-y-14 lg:grid-cols-[1.25fr_1fr] lg:gap-x-24">
          <AssessmentRequestForm />

          <aside className="flex flex-col gap-4">
            <Card on="cream-200">
              <div className="label mb-3 text-accent">How pricing works</div>
              <p className="text-[15px] leading-[1.7] text-ink-muted">
                We start with the paid safety risk assessment: a fixed-fee
                engagement that produces a documented compliance baseline for
                your sites. From there it&rsquo;s equipment and setup upfront,
                then an annual subscription priced to your operation&rsquo;s
                size. We quote per site, because a six-camera shop and a
                fifty-camera plant aren&rsquo;t the same job.
              </p>
            </Card>
            <Card on="cream-200">
              <div className="label mb-3 text-accent">
                No imagery by default
              </div>
              <p className="text-[15px] leading-[1.7] text-ink-muted">
                Default mode stores structured events only. Snapshots are off
                unless you deliberately enable them, per site.
              </p>
            </Card>
            <Card on="cream-200">
              <div className="label mb-3 text-accent">Runs on your cameras</div>
              <p className="text-[15px] leading-[1.7] text-ink-muted">
                The assessment uses the feeds you already have. The only new
                equipment is one small edge computer per six to eight cameras,
                quoted separately and never bundled into the subscription.
              </p>
            </Card>
            <Card on="cream-200">
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
