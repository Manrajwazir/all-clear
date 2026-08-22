import Container from "@/components/site/Container";
import { SolidCTA, OutlineCTA } from "@/components/site/Buttons";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <Container className="py-[clamp(72px,12vw,160px)]">
      <div className="label-mono mb-8 text-slate">Error 404</div>
      <h1 className="max-w-[18ch] text-[clamp(30px,5.4vw,56px)] font-medium leading-[1.06] tracking-[-0.025em]">
        That page isn&rsquo;t here.
      </h1>
      <p className="mt-7 max-w-[54ch] text-[17px] font-light leading-[1.6] text-slate">
        The link may be out of date. Everything on the site is one step away
        from the home page.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <SolidCTA href="/">Home</SolidCTA>
        <OutlineCTA href="/contact">Request a pilot</OutlineCTA>
      </div>
    </Container>
  );
}
