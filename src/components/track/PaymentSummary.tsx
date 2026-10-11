import { Banknote, CheckCircle2, Clock, Undo2 } from "lucide-react";
import { formatINR } from "@/domain/money";
import type { Order } from "@/store/DataStore";
import { paymentTotals } from "./format";

/** Paid and due amounts, with the counter note when cash is still owed. */
export function PaymentSummary({ order }: { order: Order }) {
  const { paid, cashDue, onlinePending } = paymentTotals(order);
  const closed = order.status === "rejected" || order.status === "cancelled";
  const onlineOnly = order.payments.every((p) => p.status !== "success" || p.method === "online");
  const due = order.bill.total - paid;
  const row = "flex items-baseline justify-between gap-4";
  return (
    <div>
      <dl className="space-y-2 text-[0.95rem]">
        <div className={row}>
          <dt className="text-muted-foreground">Order total</dt>
          <dd className="tabular-nums">{formatINR(order.bill.total)}</dd>
        </div>
        {!(closed && paid > 0) && (
          <div className={row}>
            <dt className="text-muted-foreground">Paid</dt>
            <dd className="font-bold text-success tabular-nums">{formatINR(paid)}</dd>
          </div>
        )}
        {!closed && due > 0 && (
          <div className={row}>
            <dt className="text-muted-foreground">Due</dt>
            <dd className="font-bold tabular-nums">{formatINR(due)}</dd>
          </div>
        )}
      </dl>
      {closed && paid > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted p-3 text-sm font-bold">
          <Undo2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          {formatINR(paid)} paid{onlineOnly ? " online" : ""} — refund initiated (demo)
        </p>
      )}
      {!closed && cashDue > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-accent/20 p-3 font-bold text-foreground">
          <Banknote className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          Pay {formatINR(cashDue)} at the counter
        </p>
      )}
      {!closed && onlinePending > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted p-3 text-sm">
          <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          Online payment of {formatINR(onlinePending)} is still pending.
        </p>
      )}
      {!closed && due <= 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm font-bold text-success">
          <CheckCircle2 className="size-5" aria-hidden="true" /> Paid in full. Thank you!
        </p>
      )}
    </div>
  );
}
