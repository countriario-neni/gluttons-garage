import { cn } from "cn";
import { dietLabel, type Diet } from "@/lib/menu";

/**
 * Indian food mark: square with a circle (veg / egg) or a triangle (non-veg),
 * always paired with a text label so it never relies on colour alone.
 */
export function DietMark({ diet, className }: { diet: Diet; className?: string }) {
  const tone = diet === "veg" ? "text-success" : diet === "egg" ? "text-timber" : "text-destructive";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground", className)}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className={cn("size-4 shrink-0", tone)}>
        <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        {diet === "non-veg" ? <path d="M8 4.2 12 11.4H4z" fill="currentColor" /> : <circle cx="8" cy="8" r="3.4" fill="currentColor" />}
      </svg>
      {dietLabel[diet]}
    </span>
  );
}
