"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "cn";
import { MAX_QTY } from "@/lib/cart";

/** − qty + control; at qty 1 the minus becomes a remove (bin) when `removable`. */
export function QtyStepper({
  qty,
  onChange,
  label,
  removable = false,
  size = "md",
  className,
}: {
  qty: number;
  onChange: (qty: number) => void;
  /** Item name for screen-reader labels. */
  label?: string;
  removable?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const showBin = removable && qty <= 1;
  const btn = "grid size-11 place-items-center rounded-full transition-colors hover:bg-primary/10 disabled:opacity-40";
  const suffix = label ? ` ${label}` : "";
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border-2 border-primary bg-card text-primary",
        size === "sm" ? "h-11" : "h-12",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        disabled={!removable && qty <= 1}
        aria-label={showBin ? `Remove${suffix}` : `Decrease quantity${suffix}`}
        className={btn}
      >
        {showBin ? <Trash2 className="size-4" aria-hidden="true" /> : <Minus className="size-4" aria-hidden="true" />}
      </button>
      <span aria-live="polite" className="min-w-6 text-center font-bold tabular-nums">
        <span className="sr-only">Quantity </span>
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        disabled={qty >= MAX_QTY}
        aria-label={`Increase quantity${suffix}`}
        className={btn}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
