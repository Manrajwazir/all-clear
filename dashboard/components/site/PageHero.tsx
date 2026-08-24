import Container from "./Container";
import { Eyebrow } from "./Band";

/**
 * The opening block on interior pages. Sits on the base cream so the
 * first band below it always reads as a surface change.
 */
export default function PageHero({
  eyebrow,
  aside,
  title,
  lead,
}: {
  eyebrow: string;
  aside?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
}) {
  return (
    <Container className="pb-[clamp(40px,6vw,72px)] pt-[clamp(48px,7vw,88px)]">
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        {aside}
      </div>
      <h1 className="max-w-[20ch] text-[clamp(32px,5.6vw,60px)] font-medium leading-[1.05] tracking-[-0.025em]">
        {title}
      </h1>
      {lead && (
        <p className="measure mt-7 text-[17px] leading-[1.65] text-ink-muted sm:text-[19px]">
          {lead}
        </p>
      )}
    </Container>
  );
}
