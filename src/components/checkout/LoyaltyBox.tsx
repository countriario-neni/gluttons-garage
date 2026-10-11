"use client";

import { Gift } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { LOYALTY } from "@/domain/loyalty";
import { formatINR } from "@/domain/money";

/** Points balance for the entered phone and the "Redeem N points for ₹X" toggle. */
export function LoyaltyBox({
  points,
  redeemable,
  redeem,
  onRedeem,
  earn,
  error,
}: {
  points: number;
  /** Largest redeemable multiple of 100 for this bill (maxRedeemablePoints). */
  redeemable: number;
  redeem: boolean;
  onRedeem: (v: boolean) => void;
  earn: number;
  error?: string;
}) {
  const value = (redeemable / LOYALTY.redeemBlock) * LOYALTY.redeemValue;
  return (
    <div className="rounded-2xl border border-border bg-secondary/50 p-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <Gift className="size-5" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <p className="font-bold">
            {points > 0 ? `You have ${points} points` : "Garage Rewards"}
          </p>
          <p className="text-sm text-muted-foreground">
            {redeemable > 0
              ? `Worth ${formatINR(value)} off this order.`
              : points > 0
                ? `Redeem from ${LOYALTY.redeemBlock} points (up to half the bill).`
                : `Earn 1 point for every ₹${LOYALTY.earnPerRupees} you spend.`}{" "}
            {earn > 0 && <>This order earns {earn} points.</>}
          </p>
        </div>
      </div>
      {redeemable > 0 && (
        <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl bg-card px-3 py-2">
          <span className="text-sm font-bold">
            Redeem {redeemable} points for {formatINR(value)}
          </span>
          <Switch checked={redeem} onCheckedChange={onRedeem} aria-label={`Redeem ${redeemable} points for ${formatINR(value)}`} />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
