import Band, { Card, Eyebrow } from "@/components/site/Band";
import PageHero from "@/components/site/PageHero";
import { PrimaryCTA, MailLink } from "@/components/site/Buttons";

export const metadata = {
  title: "Contact",
  description:
    "Reach All Clear in Edmonton, Alberta, at hello@allclearsafety.ca. To scope a site or get a quote, request a safety risk assessment.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the two people who build it."
        lead="There is no sales team to route around. Email reaches both founders directly, and we answer our own inbox."
      />

      <Band tone="cream-200">
        <div className="grid grid-cols-1 gap-y-12 lg:grid-cols-[1fr_1fr] lg:gap-x-20">
          <div>
            <Eyebrow className="mb-6">General enquiries</Eyebrow>
            <h2 className="text-[clamp(24px,3vw,34px)] font-medium leading-[1.2] tracking-[-0.02em]">
              Questions about privacy, partnerships, or press.
            </h2>
            <p className="measure mt-6 text-[16px] leading-[1.7] text-ink-muted sm:text-[17px]">
              Anything that isn&rsquo;t a request to scope a site is best sent
              by email. That includes privacy questions and requests about your
              own information under Alberta PIPA, which are covered in the
              privacy policy.
            </p>
            <div className="mt-6 text-[18px]">
              <MailLink>hello@allclearsafety.ca</MailLink>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:content-start">
            <Card on="cream-200">
              <div className="label mb-3 text-accent">Where we are</div>
              <p className="text-[16px] leading-[1.7]">
                Edmonton, Alberta
                <br />
                <span className="text-ink-muted">Canada</span>
              </p>
            </Card>
            <Card on="cream-200">
              <div className="label mb-3 text-accent">Who answers</div>
              <p className="text-[16px] leading-[1.7]">
                Both founders
                <br />
                <span className="text-ink-muted">No sales team</span>
              </p>
            </Card>
            <Card on="cream-200" className="sm:col-span-2">
              <div className="label mb-3 text-accent">Legal entity</div>
              <p className="text-[15px] leading-[1.7] text-ink-muted">
                2819394 Alberta Corp., operating as All Clear. Incorporated in
                Alberta.
              </p>
            </Card>
          </div>
        </div>
      </Band>

      {/* Scoping a site belongs on the assessment page, not here. */}
      <Band tone="navy" size="loose">
        <div className="grid grid-cols-1 gap-y-9 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-x-20">
          <div>
            <Eyebrow inverse className="mb-6">
              Looking to scope a site?
            </Eyebrow>
            <h2 className="max-w-[24ch] text-[clamp(26px,3.6vw,42px)] font-medium leading-[1.1] tracking-[-0.025em]">
              That starts with a risk assessment, not an email thread.
            </h2>
            <p className="measure mt-6 text-[16px] leading-[1.7] text-ink-inverse/85 sm:text-[17px]">
              The assessment form asks the handful of things we need to scope
              properly, like site type, existing cameras and COR status, so the
              first call is useful rather than exploratory.
            </p>
          </div>
          <div className="flex lg:justify-end">
            <PrimaryCTA inverse href="/assessment" className="whitespace-nowrap">
              Request an assessment
            </PrimaryCTA>
          </div>
        </div>
      </Band>
    </>
  );
}
