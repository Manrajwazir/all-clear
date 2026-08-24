import { cn } from "@/lib/utils";

/**
 * The content grid. Wider than the old 1120 so layouts reach across
 * the screen; running text is held to `.measure` separately rather
 * than by squeezing the whole page.
 */
export default function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1440px] px-[clamp(20px,5vw,64px)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
