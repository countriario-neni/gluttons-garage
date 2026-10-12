"use client";

import { useId, useState } from "react";
import { cn } from "cn";
import { Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/domain/money";
import { useStore } from "@/store";
import type { Order } from "@/store/DataStore";
import { placeLabel, quickAmounts, staffErrorCopy } from "./format";

type Props = { order: Order; due: number; onClose: () => void };

/**
 * Counter cash: records exactly the amount due (the store rejects anything else) and works out the change
 * from what the customer handed over.
 */
export function SettleCashDialog({ order, due, onClose }: Props) {
  const store = useStore();
  const [received, setReceived] = useState(String(due));
  const [pending, setPending] = useState(false);
  const errId = useId();
  const amount = Number(received);
  const valid = received.trim() !== "" && Number.isInteger(amount);
  const short = valid && amount < due;
  const change = valid && !short ? amount - due : null;

  async function record() {
    if (!valid || short) return;
    setPending(true);
    try {
      await store.recordCashPayment(order.id, due);
      toast.success(`${formatINR(due)} cash recorded · ${order.code}`, {
        description: change ? `Give ${formatINR(change)} change.` : "Exact amount, no change.",
      });
      onClose();
    } catch (e) {
      toast.error(staffErrorCopy(e), { description: `${order.code} · ${placeLabel(order)}` });
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="theme-kitchen gap-5 p-6 shadow-lift ring-2 ring-primary/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Settle cash · {order.code}</DialogTitle>
          <DialogDescription className="text-base">
            {placeLabel(order)} · Bill {formatINR(order.bill.total)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-baseline justify-between rounded-xl bg-card px-4 py-3">
          <span className="text-base text-muted-foreground">Cash due</span>
          <span className="text-3xl font-extrabold tabular-nums">{formatINR(due)}</span>
        </div>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void record();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="cash-received" className="text-base">
              Amount received
            </Label>
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xl font-bold text-muted-foreground">
                ₹
              </span>
              <Input
                id="cash-received"
                inputMode="numeric"
                autoComplete="off"
                value={received}
                onChange={(e) => setReceived(e.target.value.replace(/[^\d]/g, ""))}
                onFocus={(e) => e.target.select()}
                aria-invalid={short || !valid ? true : undefined}
                aria-describedby={errId}
                className="h-14 pl-8 text-2xl font-bold tabular-nums"
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
              {quickAmounts(due).map((a, i) => (
                <Button
                  key={a}
                  type="button"
                  variant={amount === a ? "default" : "secondary"}
                  className="h-11 px-4 text-base font-bold"
                  onClick={() => setReceived(String(a))}
                >
                  {i === 0 ? `Exact ${formatINR(a)}` : `Next ${formatINR(a)}`}
                </Button>
              ))}
            </div>
          </div>

          <div id={errId} aria-live="polite" className={cn("flex items-baseline justify-between rounded-xl border px-4 py-3", short || !valid ? "border-destructive" : "border-border")}>
            {short || !valid ? (
              <span className="font-bold text-foreground">
                {valid ? `That's less than the amount due (${formatINR(due)}).` : "Enter the amount received."}
              </span>
            ) : (
              <>
                <span className="text-base text-muted-foreground">Change to give</span>
                <span data-testid="change-due" className="text-3xl font-extrabold text-primary tabular-nums">
                  {formatINR(change ?? 0)}
                </span>
              </>
            )}
          </div>

          <DialogFooter className="-mx-6 -mb-6 bg-card p-4">
            <Button type="button" variant="outline" className="h-12 px-5 text-base" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="h-12 px-5 text-base font-bold" disabled={pending || short || !valid}>
              {pending ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Banknote className="size-5" aria-hidden="true" />}
              Record {formatINR(due)} cash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
