"use client";

import { ChevronDown, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { cn } from "cn";
import type { OrderMode } from "@/domain/types";

/** "Dine-in · Table 4" / "Takeaway · 6:30 PM" pill; tap to change. */
export function ModeChip({ mode, label, onClick, className }: { mode: OrderMode | null; label: string | null; onClick: () => void; className?: string }) {
  const Icon = mode === "takeaway" ? ShoppingBag : UtensilsCrossed;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-2 px-4 text-sm font-bold whitespace-nowrap transition-colors",
        label ? "border-primary bg-primary/5 text-primary hover:bg-primary/10" : "border-accent bg-accent text-accent-foreground",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label ?? "Dine-in or takeaway?"}
      <span className="sr-only">, change</span>
      <ChevronDown className="size-4 opacity-70" aria-hidden="true" />
    </button>
  );
}
