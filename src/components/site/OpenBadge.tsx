"use client";

import { cn } from "cn";
import { cafe } from "@/data/cafe";
import { openStatus } from "@/domain/slots";
import { useCafeClock } from "./useCafeClock";

/** Live open/closed pill. Computed after hydration (IST wall clock) so the static HTML never mismatches. */
export function OpenBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  const now = useCafeClock();
  const status = now && openStatus(now, cafe.hours);

  if (!status) return <span aria-hidden="true" className={cn("inline-block h-8 w-28", className)} />;

  const label = compact ? (status.open ? "Open now" : "Closed now") : status.label;
  return (
    <span
      role="status"
      title={status.label}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-bold whitespace-nowrap",
        status.open ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      <span aria-hidden="true" className="relative flex size-2">
        {status.open && <span className="absolute inset-0 animate-ping rounded-full bg-cream-light opacity-60" />}
        <span className={cn("relative size-2 rounded-full", status.open ? "bg-cream-light" : "bg-destructive")} />
      </span>
      {label}
    </span>
  );
}
