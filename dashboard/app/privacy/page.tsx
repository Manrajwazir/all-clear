import Band, { Card, Eyebrow } from "@/components/site/Band";
import PageHero from "@/components/site/PageHero";
import { MailLink } from "@/components/site/Buttons";

export const metadata = {
  title: "Privacy policy",
  description:
    "How All Clear handles information from website visitors and from customers running the system on their sites, under Alberta PIPA.",
};

const LAST_UPDATED = "23 August 2026";

const CONTENTS = [
  ["s1", "What we collect"],
  ["s2", "Imagery and default mode"],
  ["s3", "Workers and PIPA"],
  ["s4", "How we use it"],
  ["s5", "Who we share it with"],
  ["s6", "Where it is stored"],
  ["s7", "Retention"],
  ["s8", "Your requests"],
  ["s9", "Changes"],
  ["s10", "Contact"],
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
          <div className="label text-ink-muted">
            Last updated &nbsp;·&nbsp; {LAST_UPDATED}
          </div>
        }
        title="What we collect, and what we deliberately don't."
        lead="This page explains how 2819394 Alberta Corp., operating as All Clear, handles information from visitors to this website and from customers running our system on their sites."
      />

      {/* No reveal: the contents rail inside is position:sticky, which a
          transform on the section would break. */}
      <Band tone="cream-200" reveal={false}>
        <div className="grid grid-cols-1 items-start gap-y-10 lg:grid-cols-[240px_1fr] lg:gap-x-20">
          <nav aria-label="Contents" className="lg:sticky lg:top-28">
            <Eyebrow className="mb-3">Contents</Eyebrow>
            <ol className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-1 lg:gap-y-0.5">
              {CONTENTS.map(([id, label], i) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="flex min-h-[44px] items-center gap-3 text-[14px] text-ink-muted transition-colors hover:text-accent lg:min-h-[34px]"
                  >
                    <span className="tabular text-ink-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="measure min-w-0">
            <Clause id="s1" heading="What information we collect" first>
              <P>
                When you contact us or request an assessment, we collect the
                information you send us: your name, company, role, work email,
                the type and location of the site you&rsquo;re asking about,
                your camera and COR status, and the contents of your message.
              </P>
              <P>
                When our system runs on a customer&rsquo;s site, we process
                camera feeds provided by that customer and generate compliance
                event records containing a timestamp, the site and zone, the
                source camera identifier, the type of PPE detected as absent,
                and a confidence score.
              </P>
              <Note>
                [Placeholder: final legal language to be supplied, including any
                website analytics disclosure.]
              </Note>
            </Clause>

            <Clause id="s2" heading="Imagery and default mode">
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

            <Clause id="s3" heading="Workers and PIPA">
              <P>
                We want to be precise about something that is easy to overstate.
                Storing no imagery does not automatically make an event record
                non-personal. An entry reading &ldquo;no hard hat, Zone B,
                14:03&rdquo; can identify a specific worker if only one person
                was in that zone at that time.
              </P>
              <P last>
                Employer obligations under Alberta&rsquo;s Personal Information
                Protection Act therefore still apply in default mode, including
                notifying workers that the system is in use. All Clear is the
                service provider; the customer operating the site is the
                organization responsible for that notification, and we support
                it as part of deployment.
              </P>
            </Clause>

            <Clause id="s4" heading="How we use information">
              <P>
                Contact information is used to reply to your inquiry, arrange an
                assessment, and follow up about it. We do not sell it, and we do
                not use it for unrelated marketing.
              </P>
              <P last>
                Compliance event data is used to deliver the service to the
                customer whose site produced it: writing the record, sending the
                alert, and making the log available to that customer for their
                own audit and reporting purposes.
              </P>
            </Clause>

            <Clause id="s5" heading="Who we share it with">
              <P>
                We use a small number of third-party service providers to
                operate the product. They process data on our instructions and
                only for the purpose described.
              </P>

              <Card on="cream-200" className="my-6 overflow-hidden p-0">
                <div className="flex items-baseline justify-between gap-6 px-5 py-4">
                  <span className="label text-accent">Service provider</span>
                  <span className="label text-ink-muted">Purpose</span>
                </div>
                <div className="grid grid-cols-1 gap-px bg-rule">
                  {PROCESSORS.map(([name, purpose]) => (
                    <div
                      key={name}
                      className="flex flex-col gap-1 bg-cream-50 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                    >
                      <span className="text-[15px]">{name}</span>
                      <span className="text-[14px] text-ink-muted sm:text-right">
                        {purpose}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <P last>
                We may also disclose information where we are required to by
                law.
              </P>
            </Clause>

            <Clause id="s6" heading="Where it is stored">
              <P last>
                Compliance records and any snapshots taken in snapshot mode are
                stored on Canadian infrastructure, in a Canadian region. Video
                itself does not leave the customer&rsquo;s site in default mode,
                because it is analyzed on the device there and discarded.
              </P>
            </Clause>

            <Clause id="s7" heading="How long we keep it">
              <P>
                Compliance records are retained for the period agreed with the
                customer, since their value is being available when an audit or
                review asks for a past period.
              </P>
              <Note>
                [Placeholder: specific retention periods to be supplied.]
              </Note>
            </Clause>

            <Clause id="s8" heading="Access, correction and deletion">
              <P last>
                You can ask us what information we hold about you, ask us to
                correct it, or ask us to delete it. Write to the address in the
                last section and we will respond.
              </P>
            </Clause>

            <Clause id="s9" heading="Changes to this policy">
              <P last>
                If this policy changes, we will update this page and revise the
                date at the top of it.
              </P>
            </Clause>

            <Clause id="s10" heading="Contact us" last>
              <P>
                For a privacy question or a request about your information:
              </P>
              <div className="text-[17px]">
                <MailLink>hello@allclearsafety.ca</MailLink>
              </div>
              <p className="mt-3 text-[15px] leading-[1.8] text-ink-muted">
                2819394 Alberta Corp., operating as All Clear
                <br />
                Edmonton, Alberta, Canada
              </p>
            </Clause>
          </div>
        </div>
      </Band>
    </>
  );
}

/* ── local pieces ───────────────────────────────────────────── */

function Clause({
  id,
  heading,
  first = false,
  last = false,
  children,
}: {
  id: string;
  heading: string;
  first?: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    // Reveal is applied per clause rather than to the whole band: the
    // contents rail beside it is position:sticky, and a transform on a
    // shared ancestor would become its containing block and kill it.
    <section
      id={id}
      data-reveal=""
      className={first ? "pb-10" : last ? "pt-10" : "py-10"}
    >
      <h2 className="mb-4 text-[21px] font-medium tracking-[-0.015em] sm:text-[25px]">
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
      className={`text-[16px] leading-[1.75] text-ink-muted ${
        last ? "" : "mb-4"
      }`}
    >
      {children}
    </p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-accent/40 pl-4 text-[14px] leading-[1.8] text-ink-faint">
      {children}
    </p>
  );
}
