import Container from "@/components/site/Container";
import PageHero from "@/components/site/PageHero";
import { Band, RailSection } from "@/components/site/Rail";
import { SolidCTA, OutlineCTA } from "@/components/site/Buttons";

export const metadata = {
  title: "About",
  description:
    "All Clear is built in Edmonton by two NAIT software students, with a Mitacs Labs4 research placement at NAIT's Centre for Sensors and System Integration.",
};

const COMPANY = [
  ["Legal entity", "All Clear Inc."],
  ["Registration", "2819394 Alberta Corp."],
  ["Based in", "Edmonton, Alberta"],
  ["Founders", "Two NAIT CSD students"],
];

const BACKERS = [
  ["Edmonton Unlimited", "Venture support"],
  ["Alberta Innovates", "Provincial innovation support"],
  ["City of Edmonton", "Municipal support"],
  ["NAIT CSSI", "Mitacs Labs4 research placement"],
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Two software students in Edmonton, building the boring half of safety."
      />

      {/* ── Why this ─────────────────────────────────────────── */}
      <Band>
        <RailSection label="Why this" className="py-[clamp(40px,6.5vw,72px)]">
          <div className="max-w-[68ch]">
            <p className="mb-5 text-[18px] font-light leading-[1.6] text-navy sm:text-[20px]">
              All Clear started with a wrong assumption. We thought the problem
              worth solving was catching PPE violations as they happen.
            </p>
            <p className="mb-5 text-[17px] font-light leading-[1.7] text-slate">
              Then we talked to the people who would actually use it.
              Supervisors already know their sites. They know which gate people
              cut through without a hat on and roughly when. What they
              don&rsquo;t have is anything to show for the checking they do all
              day. The walkaround happens; the record of the walkaround is a
              signature on a clipboard, if it exists at all.
            </p>
            <p className="mb-5 text-[17px] font-light leading-[1.7] text-slate">
              So when an auditor, an insurer or a WCB reviewer asks what
              compliance looked like on a specific afternoon four months ago,
              the honest answer is usually a shrug and a binder. That gap is the
              product. Prevention is a real benefit and it comes along for free,
              but documentation is what gets tested.
            </p>
            <p className="text-[17px] font-light leading-[1.7] text-slate">
              We built it as a sensor rather than a surveillance system for the
              same reason. On a unionized industrial site, a tool that
              photographs workers loses the room before it gets a chance to be
              useful. Default mode captures no imagery, and that constraint
              shaped the architecture instead of being bolted on afterwards.
            </p>
          </div>
        </RailSection>
      </Band>

      {/* ── Who we are ───────────────────────────────────────── */}
      <Band>
        <RailSection label="Who we are" className="py-[clamp(40px,6.5vw,72px)]">
          <p className="mb-10 max-w-[66ch] text-[17px] font-light leading-[1.7] text-slate">
            All Clear was founded by two Computer Software Development students
            at NAIT, in Edmonton. The company is incorporated in Alberta and the
            work happens here, on Alberta sites, with Alberta operators.
          </p>

          <div className="border border-rule-strong bg-cream-wash">
            <div className="label-mono border-b border-rule px-6 py-4">
              Company record
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {COMPANY.map(([label, value], i) => (
                <div
                  key={label}
                  className={[
                    "px-6 py-5",
                    // Mobile: rule under every row but the last.
                    i < COMPANY.length - 1 ? "border-b border-rule-soft" : "",
                    // Two-up: rule between the columns, and under the top row only.
                    i % 2 === 0 ? "sm:border-r sm:border-rule-soft" : "",
                    i < 2
                      ? "sm:border-b sm:border-rule-soft"
                      : "sm:border-b-0",
                  ].join(" ")}
                >
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate">
                    {label}
                  </div>
                  <div className="font-mono text-[14px]">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </RailSection>
      </Band>

      {/* ── Research & support ───────────────────────────────── */}
      <Band inverse>
        <RailSection
          label="Research & support"
          inverse
          className="py-[clamp(48px,7.5vw,88px)]"
        >
          <h2 className="mb-6 max-w-[24ch] text-[clamp(26px,3.6vw,38px)] font-normal leading-[1.12] tracking-[-0.02em]">
            Built with a research placement, not just an idea.
          </h2>
          <p className="mb-11 max-w-[64ch] text-[17px] font-light leading-[1.65] text-cream/80">
            The detection work is being developed through a Mitacs Labs4
            research placement with NAIT&rsquo;s Centre for Sensors and System
            Integration, which means the model is evaluated under academic
            supervision rather than only by the people who wrote it.
          </p>

          <div className="grid grid-cols-1 border-t border-rule-inverse sm:grid-cols-2">
            {BACKERS.map(([name, role], i) => (
              <div
                key={name}
                className={[
                  "py-6",
                  i < BACKERS.length - 1
                    ? "border-b border-rule-inverse-soft"
                    : "",
                  i % 2 === 0 ? "sm:border-r sm:border-rule-inverse-soft sm:pr-8" : "sm:pl-8",
                  i < 2
                    ? "sm:border-b sm:border-rule-inverse-soft"
                    : "sm:border-b-0",
                ].join(" ")}
              >
                <div className="mb-1.5 text-[19px] font-medium">{name}</div>
                <div className="font-mono text-[11px] tracking-[0.1em] text-slate-light">
                  {role}
                </div>
              </div>
            ))}
          </div>
        </RailSection>
      </Band>

      {/* ── Closing CTA ──────────────────────────────────────── */}
      <Band>
        <Container className="flex flex-wrap items-end justify-between gap-x-14 gap-y-9 py-[clamp(52px,8vw,96px)]">
          <h2 className="max-w-[22ch] text-[clamp(27px,4vw,42px)] font-normal leading-[1.1] tracking-[-0.02em]">
            We&rsquo;d rather show you on your own site than pitch you.
          </h2>
          <div className="flex flex-wrap gap-4">
            <SolidCTA href="/contact" className="whitespace-nowrap">
              Request a pilot
            </SolidCTA>
            <OutlineCTA href="/how-it-works" className="whitespace-nowrap">
              How it works
            </OutlineCTA>
          </div>
        </Container>
      </Band>
    </>
  );
}
