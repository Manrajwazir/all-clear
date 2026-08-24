import Band, { Eyebrow } from "@/components/site/Band";
import { PrimaryCTA, SecondaryCTA } from "@/components/site/Buttons";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <Band tone="cream" size="loose">
      <Eyebrow className="mb-8">Error 404</Eyebrow>
      <h1 className="max-w-[18ch] text-[clamp(32px,5.6vw,60px)] font-medium leading-[1.05] tracking-[-0.025em]">
        That page isn&rsquo;t here.
      </h1>
      <p className="measure mt-7 text-[17px] leading-[1.65] text-ink-muted">
        The link may be out of date. Everything on the site is one step away
        from the home page.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <PrimaryCTA href="/">Home</PrimaryCTA>
        <SecondaryCTA href="/assessment">Request an assessment</SecondaryCTA>
      </div>
    </Band>
  );
}
