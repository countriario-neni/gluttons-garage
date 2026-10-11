"use client";

import { Banknote, Smartphone, SplitSquareHorizontal } from "lucide-react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { formatINR } from "@/domain/money";
import { splitRemainder } from "@/domain/validation";

export type PlanKind = "online" | "cash" | "split";

function Option({ value, checked, onSelect, icon, title, hint, children }: { value: PlanKind; checked: boolean; onSelect: () => void; icon: ReactNode; title: string; hint: string; children?: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border-2 transition-colors", checked ? "border-primary bg-primary/5" : "border-border bg-card")}>
      <label className="flex min-h-16 cursor-pointer items-center gap-3 p-3.5">
        <input type="radio" name="plan" value={value} checked={checked} onChange={onSelect} className="size-5 shrink-0 accent-primary" />
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary">{icon}</span>
        <span className="flex-1">
          <span className="block font-bold">{title}</span>
          <span className="block text-sm text-muted-foreground">{hint}</span>
        </span>
      </label>
      {checked && children}
    </div>
  );
}

/** Pay online / at the counter / split. Cash and split are dine-in only, so takeaway shows online alone. */
export function PlanPicker({
  dineIn,
  plan,
  onPlan,
  total,
  splitInput,
  onSplitInput,
  splitError,
}: {
  dineIn: boolean;
  plan: PlanKind;
  onPlan: (p: PlanKind) => void;
  total: number;
  splitInput: string;
  onSplitInput: (v: string) => void;
  splitError: string | null;
}) {
  const online = Number(splitInput);
  const split = splitInput ? splitRemainder(total, online) : null;
  return (
    <fieldset className="space-y-2.5">
      <legend className="sr-only">How would you like to pay?</legend>
      <Option
        value="online"
        checked={plan === "online"}
        onSelect={() => onPlan("online")}
        icon={<Smartphone className="size-5" aria-hidden="true" />}
        title="Pay online"
        hint="UPI, cards, netbanking, wallets, pay later"
      />
      {dineIn && (
        <>
          <Option
            value="cash"
            checked={plan === "cash"}
            onSelect={() => onPlan("cash")}
            icon={<Banknote className="size-5" aria-hidden="true" />}
            title="Pay at counter"
            hint="Cash or card at the counter after your meal"
          />
          <Option
            value="split"
            checked={plan === "split"}
            onSelect={() => onPlan("split")}
            icon={<SplitSquareHorizontal className="size-5" aria-hidden="true" />}
            title="Split payment"
            hint="Part online now, the rest at the counter"
          >
            <div className="border-t border-border px-3.5 pt-3 pb-4">
              <label htmlFor="split-amount" className="mb-1.5 block text-sm font-bold">
                Pay online now (₹)
              </label>
              <input
                id="split-amount"
                inputMode="numeric"
                value={splitInput}
                onChange={(e) => onSplitInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={`1 – ${Math.max(1, total - 1)}`}
                aria-invalid={splitError ? true : undefined}
                aria-describedby="split-help"
                className={cn(
                  "h-12 w-full rounded-xl border bg-background px-4 text-base font-bold tabular-nums placeholder:font-normal placeholder:text-muted-foreground",
                  splitError ? "border-destructive" : "border-input",
                )}
              />
              <p id="split-help" aria-live="polite" className={cn("mt-1.5 text-sm", splitError ? "font-bold text-destructive" : "text-muted-foreground")}>
                {splitError ??
                  (split?.ok
                    ? `Pay ${formatINR(online)} now, ${formatINR(split.cash)} at counter`
                    : `Enter an amount between ₹1 and ${formatINR(Math.max(1, total - 1))}`)}
              </p>
            </div>
          </Option>
        </>
      )}
    </fieldset>
  );
}
