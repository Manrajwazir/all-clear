import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  eyebrow?: string;
  total?: number | string;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  eyebrow,
  total,
  children,
  className,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "bg-surface-card rounded-lg p-6 shadow-card",
        "flex flex-col gap-6",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <div className="text-[10px] tracking-[0.12em] uppercase text-text-tertiary mb-1">
              {eyebrow}
            </div>
          )}
          <h3 className="text-[18px] font-medium tracking-tight">{title}</h3>
        </div>
        {total !== undefined && (
          <div className="font-mono tabular text-[28px] leading-none font-semibold text-text-primary">
            {total}
          </div>
        )}
      </header>
      <div className="flex-1 min-h-[200px]">{children}</div>
    </div>
  );
}
