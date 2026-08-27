export default function HeroPipeline() {
  return (
    <div className="relative mt-14">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .hp-scan { animation: hp-scan 3s ease-in-out infinite; }
          @keyframes hp-scan {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(160px); }
          }
          .hp-flag { animation: hp-flag 2s ease-in-out infinite; }
          @keyframes hp-flag {
            0%, 100% { opacity: 0.35; }
            50% { opacity: 1; }
          }
          .hp-flow { stroke-dasharray: 6 6; animation: hp-flow 1.4s linear infinite; }
          @keyframes hp-flow { to { stroke-dashoffset: -24; } }
          .hp-type-1 { animation: hp-type 0.4s ease-out 0.2s forwards; }
          .hp-type-2 { animation: hp-type 0.4s ease-out 0.5s forwards; }
          .hp-type-3 { animation: hp-type 0.4s ease-out 0.8s forwards; }
          .hp-type-4 { animation: hp-type 0.4s ease-out 1.1s forwards; }
          .hp-type-1, .hp-type-2, .hp-type-3, .hp-type-4 { opacity: 0; }
          @keyframes hp-type { to { opacity: 1; } }
        }
      `}</style>

      <svg
        viewBox="0 0 900 220"
        className="w-full"
        role="img"
        aria-label="Diagram: a camera scans a worker, flags a missing hard hat, and writes a timestamped compliance record"
      >
        <rect x="20" y="20" width="220" height="180" rx="12" className="fill-cream-200" />
        <text x="36" y="46" className="fill-ink-muted text-[13px] font-medium tracking-wide">
          Camera feed
        </text>
        <circle cx="130" cy="120" r="18" fill="none" stroke="currentColor" className="text-ink-muted" strokeWidth="1.5" />
        <path d="M104 176 Q130 138 156 176 Z" fill="none" stroke="currentColor" className="text-ink-muted" strokeWidth="1.5" />
        <rect x="60" y="60" width="140" height="2" className="fill-accent hp-scan" opacity="0.8" />
        <rect x="106" y="96" width="48" height="36" rx="6" fill="none" className="stroke-accent hp-flag" strokeWidth="2" />

        <line x1="242" y1="110" x2="318" y2="110" stroke="currentColor" className="text-ink-muted hp-flow" strokeWidth="1.5" markerEnd="url(#hp-arrow)" />

        <rect x="320" y="60" width="140" height="100" rx="10" className="fill-cream-200" />
        <text x="390" y="100" textAnchor="middle" className="fill-ink text-[13px] font-medium">
          No hard hat
        </text>
        <text x="390" y="120" textAnchor="middle" className="fill-ink-muted text-[12px]">
          Confidence 0.94
        </text>

        <line x1="462" y1="110" x2="538" y2="110" stroke="currentColor" className="text-ink-muted hp-flow" strokeWidth="1.5" markerEnd="url(#hp-arrow)" />

        <rect x="540" y="20" width="340" height="180" rx="12" className="fill-navy" />
        <text x="560" y="46" className="fill-ink-inverse text-[13px] font-medium tracking-wide">
          Compliance record
        </text>
        <text x="560" y="76" className="fill-ink-inverse-muted text-[12px] hp-type-1">
          Site: Yard 4 · North gate
        </text>
        <text x="560" y="98" className="fill-ink-inverse-muted text-[12px] hp-type-2">
          Camera: CAM-07
        </text>
        <text x="560" y="120" className="fill-ink-inverse-muted text-[12px] hp-type-3">
          Event: Hard hat not detected
        </text>
        <text x="560" y="142" className="fill-ink-inverse-muted text-[12px] hp-type-4">
          Imagery retained: none · default mode
        </text>

        <defs>
          <marker id="hp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}