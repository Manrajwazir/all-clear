import Container from "@/components/site/Container";
import PageHero from "@/components/site/PageHero";
import { Band } from "@/components/site/Rail";
import PilotRequestForm from "@/components/contact/PilotRequestForm";

export const metadata = {
  title: "Request a pilot",
  description:
    "A pilot runs on your own cameras, on one site, so you are evaluating real records from your own yard rather than a demo.",
};

const ASSURANCES = [
  [
    "No credit card",
    "The pilot has no cost and no commitment attached. Nothing is invoiced during it.",
  ],
  [
    "Your own cameras",
    "The demo runs on the feeds you already have, on a site you pick. No hardware purchase to evaluate it.",
  ],
  [
    "No imagery by default",
    "Default mode stores structured events only. Snapshots are off unless you ask for them.",
  ],
  [
    "What happens next",
    "A short call about your camera setup and the zones you need documented, then we scope the pilot from there.",
  ],
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Request a pilot"
        title="Tell us about one site. We'll take it from there."
        lead="A pilot runs on your own cameras, on one site, so you are evaluating real records from your own yard rather than a demo."
      />

      <Band>
        <Container className="grid grid-cols-1 items-start gap-y-12 pb-[clamp(48px,7.5vw,88px)] pt-[clamp(36px,6vw,64px)] lg:grid-cols-[1.3fr_1fr] lg:gap-x-20">
          <PilotRequestForm />

          <aside className="flex flex-col border-t border-rule-strong">
            {ASSURANCES.map(([heading, body], i) => (
              <div
                key={heading}
                className={`py-6 ${
                  i < ASSURANCES.length - 1 ? "border-b border-rule-soft" : ""
                }`}
              >
                <h2 className="label-mono mb-2.5 text-slate">{heading}</h2>
                <p className="text-[15px] font-light leading-[1.65] text-slate">
                  {body}
                </p>
              </div>
            ))}
          </aside>
        </Container>
      </Band>
    </>
  );
}
