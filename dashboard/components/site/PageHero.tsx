import Container from "./Container";

/**
 * The opening block on every interior page: a mono eyebrow, a large heading,
 * and an optional standfirst. `aside` carries the dated line on the privacy page.
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
    <Container className="pb-[clamp(44px,6.5vw,72px)] pt-[clamp(48px,7.5vw,88px)]">
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 sm:mb-9">
        <div className="label-mono tracking-[0.16em] text-slate">{eyebrow}</div>
        {aside}
      </div>
      <h1 className="max-w-[20ch] text-[clamp(30px,5.4vw,56px)] font-medium leading-[1.06] tracking-[-0.025em]">
        {title}
      </h1>
      {lead && (
        <p className="mt-7 max-w-[64ch] text-[17px] font-light leading-[1.6] text-slate sm:text-[19px]">
          {lead}
        </p>
      )}
    </Container>
  );
}
