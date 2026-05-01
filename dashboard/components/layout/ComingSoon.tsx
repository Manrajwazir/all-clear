interface ComingSoonProps {
  eyebrow: string;
  title: string;
  body: string;
}

export function ComingSoon({ eyebrow, title, body }: ComingSoonProps) {
  return (
    <div className="px-6 sm:px-12 pt-12 sm:pt-16 max-w-2xl">
      <div className="text-[10px] tracking-[0.2em] uppercase text-text-tertiary mb-2">
        {eyebrow}
      </div>
      <h1 className="text-[32px] sm:text-[48px] font-semibold tracking-tight leading-tight">
        {title}
      </h1>
      <p className="mt-6 text-text-secondary text-[14px] leading-relaxed max-w-md">
        {body}
      </p>
      <div className="mt-12 inline-flex items-center gap-2 px-2 py-0.5 rounded-sm bg-status-info-bg text-status-info text-[10px] font-medium tracking-[0.08em] uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-status-info" />
        Coming soon
      </div>
    </div>
  );
}
