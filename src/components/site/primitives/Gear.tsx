import { cn } from "cn";

const TEETH = 12;

/** Gear outline, a nod to the cafe's gear mural. Decorative: colour via currentColor. */
export function Gear({ className, strokeWidth = 2.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className={cn("shrink-0", className)}>
      <g fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round">
        {Array.from({ length: TEETH }, (_, i) => (
          <rect key={i} x="43" y="5" width="14" height="14" rx="2" transform={`rotate(${(360 / TEETH) * i} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="32" />
        <circle cx="50" cy="50" r="12" />
      </g>
    </svg>
  );
}
