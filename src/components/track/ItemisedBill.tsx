import { Printer } from "lucide-react";
import { BillSummary } from "@/components/checkout/BillSummary";
import { formatINR } from "@/domain/money";
import type { Order } from "@/store/DataStore";

export function ItemisedBill({ order }: { order: Order }) {
  return (
    <div>
      <ul className="divide-y divide-border">
        {order.bill.lines.map((l, i) => (
          <li key={`${l.itemId}-${i}`} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="leading-snug font-bold">
                {l.qty} × {l.name}
              </p>
              {l.optionLabels.length > 0 && <p className="mt-0.5 text-sm text-muted-foreground">{l.optionLabels.join(", ")}</p>}
              {l.note && <p className="mt-0.5 text-sm text-muted-foreground italic">“{l.note}”</p>}
            </div>
            <p className="font-bold tabular-nums">{formatINR(l.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-border pt-4">
        <BillSummary bill={order.bill} couponCode={order.couponCode} totalLabel="Total" />
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-primary font-bold text-primary"
      >
        <Printer className="size-5" aria-hidden="true" /> Download bill
      </button>
    </div>
  );
}
