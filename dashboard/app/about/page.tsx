import Band, { Card, Eyebrow } from "@/components/site/Band";
import PageHero from "@/components/site/PageHero";
import { PrimaryCTA, SecondaryCTA } from "@/components/site/Buttons";

export const metadata = {
  title: "About Us",
  description:
    "All Clear is built in Edmonton by two NAIT software students, with a Mitacs Labs4 research placement at NAIT's Centre for Sensors and System Integration.",
};

const BACKERS = [
  ["Edmonton Unlimited", "Venture support"],
  ["Alberta Innovates", "Provincial innovation support"],
  ["City of Edmonton", "Municipal support"],
  ["NAIT", "Mitacs Labs4 research placement"],
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Us"
        title="Who We Are"
        lead="Our team at All Clear is a group of passionate individuals, with a variety of industry experience, who are dedicated to improving safety in Alberta's industrial sites."
      />

      {/* ═══ Why this — cream-200 ══════════════════════════════ */}
      <Band tone="cream-200">
        <div className="grid grid-cols-1 gap-y-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-x-20">
          <div>
            <Eyebrow className="mb-6">Our Mission</Eyebrow>
            <p className="text-[19px] font-medium leading-[1.45] tracking-[-0.01em] sm:text-[22px]">
                Make workplace safety simpler.
            </p>
          </div>
          <div className="measure space-y-5 text-[16px] leading-[1.75] text-ink-muted sm:text-[17px]">
            <p>
              Help workplaces prevent incidents before they happen. 
              We believe safety teams should spend less time chasing paperwork and more time understanding what is happening on the ground. 
              By turning everyday safety observations into clear, useful information, we help teams identify risks earlier and take action sooner.
            </p>
            <p>
              We are building technology that supports the people responsible for keeping workplaces safe. 
              Supervisors and safety managers already know their sites, their teams, and the risks they face. 
              Our role is to give them better tools to capture what they see, understand patterns, and build a 
              reliable record of the work they are already doing.
            </p>
            <p>
               Above all, we believe safety technology should earn people's trust. 
               That means building with privacy, practicality, and the realities of the workplace in mind. 
               Our goal is not to create another surveillance system. It is to give organizations the insight 
               they need to prevent the next incident and help every worker get home safely.
            </p>
          </div>
        </div>
      </Band>

      {/* ═══ Who we are — cream ════════════════════════════════ */}
      <Band tone="cream">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <Eyebrow className="mb-6">Who we are</Eyebrow>
            <h2 className="text-[clamp(24px,3vw,34px)] font-medium leading-[1.2] tracking-[-0.02em]">
              Alberta sites, Alberta operators, Alberta rules.
            </h2>
            <div className="measure mt-6 space-y-4 text-[16px] leading-[1.7] text-ink-muted sm:text-[17px]">
              <p>
                All Clear was founded by two Computer Software Development
                students at NAIT, in Edmonton. The company is incorporated in
                Alberta and the work happens here.
              </p>
              <p>
                That matters more than it sounds. The mechanics this product
                turns on are provincial: WCB experience rating, COR
                certification, the PIR rebate, PIPA. The best-funded companies
                in this category are American, and the model the largest of them
                runs on, bundling safety technology into workers&rsquo;
                compensation premiums, is not legally possible in Canada.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:content-start">
            <Card on="cream">
              <div className="label mb-3 text-accent">Based in</div>
              <div className="text-[17px] font-medium">Edmonton, Alberta</div>
            </Card>
            <Card on="cream">
              <div className="label mb-3 text-accent">Founded by</div>
              <div className="text-[17px] font-medium">
                Two NAIT CSD students
              </div>
            </Card>
            <Card on="cream">
              <div className="label mb-3 text-accent">Data residency</div>
              <div className="text-[17px] font-medium">Canada</div>
            </Card>
            <Card on="cream">
              <div className="label mb-3 text-accent">Focus</div>
              <div className="text-[17px] font-medium">
                Heavy industrial, oil &amp; gas, construction
              </div>
            </Card>
          </div>
        </div>
      </Band>

      {/* ═══ Research & support — navy ═════════════════════════ */}
      <Band tone="navy">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <Eyebrow inverse className="mb-6">
              Research &amp; support
            </Eyebrow>
            <h2 className="text-[clamp(26px,3.4vw,40px)] font-medium leading-[1.15] tracking-[-0.025em]">
              Built with a research placement, not just an idea.
            </h2>
            <p className="measure mt-6 text-[16px] leading-[1.7] text-ink-inverse/85 sm:text-[17px]">
              The detection work is being developed through a Mitacs Labs4
              research placement with NAIT&rsquo;s Centre for Sensors and System
              Integration, which means the model is evaluated under academic
              supervision rather than only by the people who wrote it. The
              tamper-evidence work on the compliance log is part of the same
              placement.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:content-start">
            {BACKERS.map(([name, role]) => (
              <Card key={name} on="navy">
                <div className="mb-2 text-[18px] font-medium">{name}</div>
                <div className="text-[13px] text-ink-inverse-muted">{role}</div>
              </Card>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="cream-200" size="loose">
        <div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-9">
          <h2 className="max-w-[20ch] text-[clamp(28px,4vw,46px)] font-medium leading-[1.1] tracking-[-0.025em]">
            We&rsquo;d rather show you on your own site than pitch you.
          </h2>
          <div className="flex flex-wrap gap-4">
            <PrimaryCTA href="/assessment" className="whitespace-nowrap">
              Request an assessment
            </PrimaryCTA>
            <SecondaryCTA href="/how-it-works" className="whitespace-nowrap">
              How it works
            </SecondaryCTA>
          </div>
        </div>
      </Band>
    </>
  );
}
