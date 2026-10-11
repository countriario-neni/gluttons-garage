"use client";

import { cn } from "cn";
import type { ReactNode } from "react";
import { formatINR } from "@/domain/money";
import type { PayChannel, PayRequest } from "@/integrations/payments/types";

export type MethodProps = {
  req: PayRequest;
  onPay: (channel: PayChannel, opts?: { vpa?: string }) => void;
};

/** Brand-neutral initials badge (no third-party logos are hotlinked or reproduced). */
export function BrandBadge({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-background text-[0.8rem] font-bold tracking-tight text-primary",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function PayButton({ amount, onClick, disabled, children }: { amount: number; onClick: () => void; disabled?: boolean; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-card transition-[transform,opacity] hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
    >
      {children ?? `Pay ${formatINR(amount)}`}
    </button>
  );
}

export function MethodHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-sans text-lg font-bold text-foreground">{title}</h3>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Selectable option row (bank, wallet, pay-later) with an initials badge. */
export function ChoiceRow({ label, initials, selected, onSelect, hint }: { label: string; initials: string; selected: boolean; onSelect: () => void; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
      )}
    >
      <BrandBadge initials={initials} />
      <span className="flex-1">
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn("grid size-5 place-items-center rounded-full border-2", selected ? "border-primary" : "border-line")}
      >
        {selected && <span className="size-2.5 rounded-full bg-primary" />}
      </span>
    </button>
  );
}

/** Inline error under a field; link it with aria-describedby. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm font-bold text-destructive">
      {children}
    </p>
  );
}
