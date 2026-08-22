import { cn } from "@/lib/utils";

/**
 * The single content measure used across every page: 1120px max,
 * with gutters that shrink to 20px on a phone and open to 48px on desktop.
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
        "mx-auto w-full max-w-[1120px] px-[clamp(20px,5vw,48px)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
