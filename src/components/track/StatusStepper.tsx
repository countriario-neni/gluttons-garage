import { Check } from "lucide-react";
import { cn } from "cn";
import type { Order } from "@/store/DataStore";
import { clockTime } from "./format";

export const STEPS = [
  { status: "placed", label: "Placed" },
  { status: "accepted", label: "Accepted" },
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "completed", label: "Completed" },
] as const;

export const statusLabel = (s: Order["status"]) =>
  s === "rejected" ? "Rejected" : s === "cancelled" ? "Cancelled" : STEPS.find((x) => x.status === s)!.label;

/** Placed → Accepted → Preparing → Ready → Completed. The current step is emphasised; times are shown where the order records them. */
export function StatusStepper({ order }: { order: Order }) {
  const current = STEPS.findIndex((s) => s.status === order.status);
  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:items-start" aria-label="Order progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        const isCurrent = i === current;
        // The order records when it was placed and when it last changed; show those two.
        const at = i === 0 ? order.createdAt : isCurrent ? order.updatedAt : null;
        return (
          <li
            key={s.status}
            aria-current={isCurrent ? "step" : undefined}
            className="relative flex flex-1 items-center gap-3 pb-5 last:pb-0 sm:flex-col sm:gap-2 sm:pb-0 sm:text-center"
          >
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-10 left-[1.1rem] h-[calc(100%-1.5rem)] w-0.5 sm:top-[1.1rem] sm:left-1/2 sm:h-0.5 sm:w-full",
                  i < current ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              key={isCurrent ? order.status : undefined}
              aria-hidden="true"
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold",
                done && "bg-primary text-primary-foreground",
                isCurrent && "animate-tick-pop bg-accent text-accent-foreground ring-4 ring-accent/30",
                !done && !isCurrent && "border-2 border-border bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="size-5" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("block leading-tight", isCurrent ? "font-bold text-primary" : done ? "font-bold" : "text-muted-foreground")}>
                {s.label}
              </span>
              {at && (done || isCurrent) && <span className="block text-xs text-muted-foreground tabular-nums">{clockTime(at)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
