"use client";

import { createContext, useContext, useState } from "react";
import { cn } from "cn";
import { Banknote, Check, ChefHat, CircleCheckBig, Clock, Loader2, MessageSquareText, PackageCheck, User, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/domain/money";
import type { OrderStatus } from "@/domain/types";
import { useStore } from "@/store";
import type { Order } from "@/store/DataStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { cashDueOf, elapsedLabel, elapsedMinutes, elapsedTone, firstName, paymentBadge, placeLabel, staffErrorCopy } from "./format";
import { SettleCashDialog } from "./SettleCashDialog";

/** The board's single ticking clock (ms); every card reads it instead of running its own timer. */
export const NowContext = createContext<number>(0);

const TONE = {
  ok: "bg-muted text-foreground",
  warn: "bg-warning text-warning-foreground",
  late: "bg-destructive text-destructive-foreground",
} as const;

const BADGE = {
  paid: "border-success bg-success text-success-foreground",
  due: "border-warning bg-transparent text-warning",
  unpaid: "border-border bg-muted text-muted-foreground",
} as const;

type Props = { order: Order; fresh?: boolean; onAcknowledge?: (id: string) => void };

export function OrderCard({ order: o, fresh, onAcknowledge }: Props) {
  const store = useStore();
  const now = useContext(NowContext);
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);

  const min = elapsedMinutes(o.createdAt, now);
  const tone = elapsedTone(min);
  const badge = paymentBadge(o);
  const cashDue = cashDueOf(o);
  const where = placeLabel(o);
  const itemCount = o.bill.lines.reduce((s, l) => s + l.qty, 0);

  async function move(to: OrderStatus) {
    setPending(to);
    onAcknowledge?.(o.id);
    try {
      await store.updateOrderStatus(o.id, to);
    } catch (e) {
      toast.error(staffErrorCopy(e), { description: `${o.code} · ${where}` });
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;
  const spin = (s: OrderStatus) => pending === s && <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
  const big = "h-14 flex-1 text-lg font-bold";

  return (
    <article
      aria-label={`Order ${o.code}`}
      data-new={fresh ? "true" : undefined}
      data-status={o.status}
      onPointerDown={fresh ? () => onAcknowledge?.(o.id) : undefined}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border-2 bg-card shadow-lift",
        fresh ? "border-primary ring-4 ring-primary/35 motion-safe:animate-[kds-flash_1.2s_ease-in-out_3]" : "border-border",
      )}
    >
      {/* Header strip: code, where, timer */}
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 pt-3 pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-sans text-3xl leading-none font-extrabold tracking-tight tabular-nums">{o.code}</h3>
            {fresh && (
              <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-extrabold tracking-wider text-primary-foreground uppercase">New</span>
            )}
          </div>
          <p className="mt-1.5 text-2xl leading-tight font-bold text-primary">
            {where.split(" · ").map((part, i) => (
              <span key={part} className="whitespace-nowrap">
                {i > 0 && " · "}
                {part}
              </span>
            ))}
          </p>
        </div>
        <span
          className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-base font-extrabold tabular-nums", TONE[tone])}
          title={`Placed ${elapsedLabel(min)} ago`}
        >
          <Clock className="size-4" aria-hidden="true" />
          <span>
            <span className="sr-only">Waiting </span>
            {elapsedLabel(min)}
          </span>
        </span>
      </header>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-sm">
        {(o.status === "accepted" || o.status === "preparing") && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 font-bold",
              o.status === "accepted" ? "bg-accent text-accent-foreground" : "bg-success text-success-foreground",
            )}
          >
            {o.status === "accepted" ? "Accepted" : "Preparing"}
          </span>
        )}
        <span className={cn("rounded-full border px-2.5 py-0.5 font-bold", BADGE[badge.tone])}>{badge.label}</span>
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          <User className="size-4" aria-hidden="true" />
          {firstName(o.customerName)}
        </span>
      </div>

      {/* Items */}
      <ul className="grid gap-2 px-4 py-3" aria-label={`${itemCount} item${itemCount === 1 ? "" : "s"}`}>
        {o.bill.lines.map((l, i) => (
          <li key={`${l.itemId}-${i}`} className="grid grid-cols-[2.5rem_1fr] gap-x-2">
            <span className="text-xl leading-snug font-extrabold tabular-nums">{l.qty}×</span>
            <span className="text-lg leading-snug font-semibold">
              {l.name}
              {l.optionLabels.length > 0 && <span className="block text-base font-normal text-muted-foreground">{l.optionLabels.join(" · ")}</span>}
              {l.note && (
                <span className="mt-1 flex items-start gap-1.5 rounded-md bg-warning px-2 py-1 text-base font-bold text-warning-foreground">
                  <MessageSquareText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="sr-only">Note: </span>
                    {l.note}
                  </span>
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Actions: one primary per state */}
      <footer className="mt-auto grid gap-2 border-t border-border bg-muted/40 p-3">
        {o.status === "placed" && (
          <div className="flex gap-2">
            <Button variant="outline" className="h-14 px-4 text-lg font-bold" disabled={busy} onClick={() => setRejectOpen(true)}>
              {spin("rejected") || <X className="size-5" aria-hidden="true" />} Reject
            </Button>
            <Button className={big} disabled={busy} onClick={() => void move("accepted")}>
              {spin("accepted") || <Check className="size-5" aria-hidden="true" />} Accept
            </Button>
          </div>
        )}
        {o.status === "accepted" && (
          <Button className={big} disabled={busy} onClick={() => void move("preparing")}>
            {spin("preparing") || <ChefHat className="size-5" aria-hidden="true" />} Start preparing
          </Button>
        )}
        {o.status === "preparing" && (
          <Button className={big} disabled={busy} onClick={() => void move("ready")}>
            {spin("ready") || <PackageCheck className="size-5" aria-hidden="true" />} Mark ready
          </Button>
        )}
        {o.status === "ready" && (
          <>
            {cashDue > 0 && (
              <Button className={big} disabled={busy} onClick={() => setSettleOpen(true)}>
                <Banknote className="size-5" aria-hidden="true" /> Settle cash {formatINR(cashDue)}
              </Button>
            )}
            <Button
              variant={cashDue > 0 ? "outline" : "default"}
              className={big}
              disabled={busy || cashDue > 0}
              aria-describedby={cashDue > 0 ? `${o.id}-settle-hint` : undefined}
              onClick={() => void move("completed")}
            >
              {spin("completed") || <CircleCheckBig className="size-5" aria-hidden="true" />} Complete
            </Button>
            {cashDue > 0 && (
              <p id={`${o.id}-settle-hint`} className="text-center text-sm font-bold text-warning">
                Settle {formatINR(cashDue)} first
              </p>
            )}
          </>
        )}
      </footer>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Reject ${o.code}?`}
        description={`${where} · ${firstName(o.customerName)}. The customer gets a WhatsApp update, and anything paid online is refunded (demo).`}
        confirmLabel="Reject order"
        cancelLabel="Keep order"
        destructive
        onConfirm={() => move("rejected")}
      />
      {settleOpen && <SettleCashDialog order={o} due={cashDue} onClose={() => setSettleOpen(false)} />}
    </article>
  );
}
