"use client";

import { Loader2, TicketPercent, X } from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import { formatINR } from "@/domain/money";

/** Coupon entry; once applied it collapses to a removable chip showing the live discount. */
export function CouponField({
  applied,
  discount,
  error,
  onApply,
  onRemove,
}: {
  applied: string | null;
  discount: number;
  error: string | null;
  onApply: (code: string) => Promise<void>;
  onRemove: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    try {
      await onApply(code.trim().toUpperCase());
    } finally {
      setBusy(false);
    }
  };

  if (applied) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-success bg-success/5 p-3">
        <TicketPercent className="size-6 shrink-0 text-success" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-bold">{applied} applied</p>
          <p className="text-sm text-success">
            {discount > 0 ? `You save ${formatINR(discount)}` : "Not applicable to this order any more"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove coupon ${applied}`}
          className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="coupon" className="mb-1.5 block text-sm font-bold">
        Coupon code
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <TicketPercent className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="coupon"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void apply();
              }
            }}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="e.g. WELCOME10"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "coupon-err" : undefined}
            className={cn(
              "h-12 w-full rounded-xl border bg-background pr-3 pl-11 text-base font-bold tracking-wider uppercase placeholder:font-normal placeholder:tracking-normal placeholder:normal-case placeholder:text-muted-foreground",
              error ? "border-destructive ring-2 ring-destructive/30" : "border-input",
            )}
          />
        </div>
        <button
          type="button"
          onClick={() => void apply()}
          disabled={!code.trim() || busy}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border-2 border-primary px-5 font-bold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Apply
        </button>
      </div>
      {error && (
        <p id="coupon-err" role="alert" className="mt-1.5 text-sm font-bold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
