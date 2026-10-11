"use client";

import { Banknote, RotateCcw, XCircle } from "lucide-react";
import { formatINR } from "@/domain/money";

export function Processing({ amount }: { amount: number }) {
  return (
    <div role="status" aria-live="assertive" className="flex flex-col items-center px-6 py-14 text-center">
      <span aria-hidden="true" className="size-16 animate-spin rounded-full border-4 border-secondary border-t-primary" />
      <p className="mt-6 text-xl font-bold text-primary">Processing {formatINR(amount)}…</p>
      <p className="mt-1 text-sm text-muted-foreground">Please don&apos;t close this window or press back.</p>
    </div>
  );
}

export function Success({ amount, reference }: { amount: number; reference: string }) {
  return (
    <div role="status" aria-live="assertive" className="flex flex-col items-center px-6 py-12 text-center">
      <svg viewBox="0 0 56 56" className="animate-tick-pop size-24 text-success" aria-hidden="true">
        <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3.5" className="animate-tick-ring" transform="rotate(-90 28 28)" />
        <path d="M17 29.5 24.5 37 39.5 21" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-tick-check" />
      </svg>
      <p className="mt-5 text-2xl font-bold text-success">Payment successful</p>
      <p className="mt-1 font-bold tabular-nums">{formatINR(amount)} paid to Gluttons Garage</p>
      <p className="mt-1 text-xs text-muted-foreground">Ref {reference}</p>
      <p className="mt-5 text-sm text-muted-foreground">Taking you to your order…</p>
    </div>
  );
}

export function Failed({
  reason,
  onRetry,
  onPayAtCounter,
}: {
  reason: string;
  onRetry: () => void;
  /** Dine-in only. */
  onPayAtCounter?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <XCircle className="size-16 text-destructive" aria-hidden="true" />
      <p className="mt-4 text-2xl font-bold text-destructive">Payment failed</p>
      <p className="mt-1 max-w-sm text-muted-foreground">{reason}. No money was taken. Your order is saved.</p>
      <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground shadow-card"
        >
          <RotateCcw className="size-4" aria-hidden="true" /> Try again
        </button>
        {onPayAtCounter && (
          <button
            type="button"
            onClick={onPayAtCounter}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-primary font-bold text-primary"
          >
            <Banknote className="size-4" aria-hidden="true" /> Pay at counter instead
          </button>
        )}
      </div>
    </div>
  );
}
