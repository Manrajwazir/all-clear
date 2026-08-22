import Container from "@/components/site/Container";
import PageHero from "@/components/site/PageHero";
import { Band } from "@/components/site/Rail";
import { MailLink } from "@/components/site/Buttons";

export const metadata = {
  title: "Privacy policy",
  description:
    "How All Clear Inc. handles information from website visitors and from customers running the system on their sites.",
};

const LAST_UPDATED = "22 AUGUST 2026";

const CONTENTS = [
  ["s1", "01", "What we collect"],
  ["s2", "02", "Imagery and default mode"],
  ["s3", "03", "How we use it"],
  ["s4", "04", "Who we share it with"],
  ["s5", "05", "Retention"],
  ["s6", "06", "Your requests"],
  ["s7", "07", "Changes"],
  ["s8", "08", "Contact"],
];

const PROCESSORS = [
  ["Database provider", "Storing compliance records"],
  ["Cloud storage provider", "Snapshot mode only, when enabled"],
  ["SMS provider", "Delivering alerts to supervisors"],
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Privacy policy"
        aside={
          <div className="font-mono text-[11px] tracking-[0.1em] text-slate">
            LAST UPDATED &mdash; {LAST_UPDATED}
          </div>
        }
        title="What we collect, and what we deliberately don't."
        lead="This page explains how All Clear Inc. handles information from visitors to this website and from customers running our system on their sites."
      />

      <Band>
        <Container className="grid grid-cols-1 items-start gap-y-10 py-14 lg:grid-cols-[240px_1fr] lg:gap-x-16">
          {/* Contents — two-up on a phone so it doesn't push the policy off
              the first screen, sticky rail from lg up. */}
          <nav aria-label="Contents" className="lg:sticky lg:top-28">
            <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
              Contents
            </h2>
            <ul className="grid grid-cols-2 gap-x-6 lg:grid-cols-1 lg:gap-y-0.5">
              {CONTENTS.map(([id, num, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="flex min-h-[44px] items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-slate transition-colors hover:text-navy lg:min-h-[32px]"
                  >
                    <span>{num}</span>
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 max-w-[70ch]">
            <Clause id="s1" num="01" heading="What information we collect">
              <P>
                When you contact us or request a pilot, we collect the
                information you send us: your name, company, role, work email,
                the type and location of the site you&rsquo;re asking about, and
                the contents of your message.
              </P>
              <P>
                When our system runs on a customer&rsquo;s site, we process
                camera feeds provided by that customer and generate compliance
                event records containing a timestamp, the site and zone, the
                source camera identifier, and the type of PPE detected as
                absent.
              </P>
              <Note>
                [Placeholder &mdash; final legal language to be supplied,
                including any website analytics disclosure.]
              </Note>
            </Clause>

            <Clause id="s2" num="02" heading="Imagery and default mode">
              <P>
                In default mode, All Clear collects no imagery. Camera frames
                are analyzed on a device located on the customer&rsquo;s site
                and are not retained or transmitted. What is stored is a
                structured event record describing what was detected, where, and
                when.
              </P>
              <P last>
                An optional snapshot mode can be enabled by a customer, per
                site, if their incident process requires a still image attached
                to an event. That mode is off unless the customer turns it on,
                and it is the only configuration in which an image is stored.
              </P>
            </Clause>

            <Clause id="s3" num="03" heading="How we use information">
              <P>
                Contact information is used to reply to your inquiry, arrange a
                pilot, and follow up about it. We do not sell it, and we do not
                use it for unrelated marketing.
              </P>
              <P last>
                Compliance event data is used to deliver the service to the
                customer whose site produced it: writing the record, sending the
                alert, and making the log available to that customer for their
                own audit and reporting purposes.
              </P>
            </Clause>

            <Clause id="s4" num="04" heading="Who we share it with">
              <P>
                We use a small number of third-party service providers to
                operate the product. They process data on our instructions and
                only for the purpose described.
              </P>

              <div className="mb-4 mt-6 border border-rule-strong bg-cream-wash">
                <div className="flex items-baseline justify-between gap-6 border-b border-rule px-5 py-3.5">
                  <span className="label-mono">Service provider</span>
                  <span className="label-mono text-slate">Purpose</span>
                </div>
                {PROCESSORS.map(([name, purpose], i) => (
                  <div
                    key={name}
                    className={`flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 ${
                      i < PROCESSORS.length - 1
                        ? "border-b border-rule-soft"
                        : ""
                    }`}
                  >
                    <span className="text-[15px]">{name}</span>
                    <span className="font-mono text-[13px] text-slate sm:text-right">
                      {purpose}
                    </span>
                  </div>
                ))}
              </div>

              <P last>
                We may also disclose information where we are required to by
                law.
              </P>
            </Clause>

            <Clause id="s5" num="05" heading="How long we keep it">
              <P>
                Compliance records are retained for the period agreed with the
                customer, since their value is being available when an audit or
                review asks for a past period.
              </P>
              <Note>
                [Placeholder &mdash; specific retention periods to be supplied.]
              </Note>
            </Clause>

            <Clause id="s6" num="06" heading="Access, correction and deletion">
              <P last>
                You can ask us what information we hold about you, ask us to
                correct it, or ask us to delete it. Write to the address in
                section 08 and we will respond.
              </P>
            </Clause>

            <Clause id="s7" num="07" heading="Changes to this policy">
              <P last>
                If this policy changes, we will update this page and revise the
                date at the top of it.
              </P>
            </Clause>

            <Clause id="s8" num="08" heading="Contact us" last>
              <P>
                For a privacy question or a request about your information:
              </P>
              <p className="font-mono text-[14px] leading-[2] tracking-[0.04em]">
                <MailLink>hello@allclearsafety.ca</MailLink>
                <br />
                <span className="text-slate">
                  All Clear Inc. &mdash; Edmonton, Alberta, Canada
                </span>
              </p>
            </Clause>
          </div>
        </Container>
      </Band>
    </>
  );
}

/* ── local pieces ───────────────────────────────────────────── */

function Clause({
  id,
  num,
  heading,
  last = false,
  children,
}: {
  id: string;
  num: string;
  heading: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={
        num === "01"
          ? "pb-11"
          : last
            ? "border-t border-rule-soft pt-11"
            : "border-t border-rule-soft py-11"
      }
    >
      <div className="label-mono mb-3.5 text-slate">{num}</div>
      <h2 className="mb-4 text-[22px] font-medium tracking-[-0.015em] sm:text-[26px]">
        {heading}
      </h2>
      {children}
    </section>
  );
}

function P({
  last = false,
  children,
}: {
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`text-[16px] font-light leading-[1.75] text-slate ${
        last ? "" : "mb-3.5"
      }`}
    >
      {children}
    </p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[12px] leading-[1.9] tracking-[0.04em] text-slate">
      {children}
    </p>
  );
}
