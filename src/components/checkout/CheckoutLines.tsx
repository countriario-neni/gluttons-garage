"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "cn";
import { DietMark } from "@/components/site/primitives/DietMark";
import { QtyStepper } from "@/components/order/QtyStepper";
import type { PreviewLine } from "@/components/order/useOrderData";
import { formatINR } from "@/domain/money";
import { dietOf } from "@/lib/menu";

/** Cart lines on checkout; a line the store rejected (sold out, bad option) is highlighted with a remove action. */
export function CheckoutLines({
  rows,
  badItemId,
  onQty,
  onRemove,
}: {
  rows: PreviewLine[];
  badItemId: string | null;
  onQty: (index: number, qty: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => {
        const bad = !r.available || r.itemId === badItemId;
        const diet = r.item ? dietOf(r.item) : null;
        return (
          <li
            key={`${r.itemId}-${r.index}`}
            data-bad-line={bad || undefined}
            className={cn("flex items-start gap-3 py-4", bad && "-mx-3 rounded-xl bg-destructive/5 px-3 ring-2 ring-destructive")}
          >
            <div className="min-w-0 flex-1">
              {diet && <DietMark diet={diet} className="mb-1" />}
              <p className="leading-snug font-bold">{r.name}</p>
              {r.optionLabels.length > 0 && <p className="mt-0.5 text-sm text-muted-foreground">{r.optionLabels.join(", ")}</p>}
              {r.note && <p className="mt-0.5 text-sm text-muted-foreground italic">“{r.note}”</p>}
              {bad ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-destructive">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  {r.item && !r.item.available ? "Sold out right now" : "No longer available"}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                  {formatINR(r.unitPrice)} × {r.qty}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {bad ? (
                <button
                  type="button"
                  onClick={() => onRemove(r.index)}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full bg-destructive px-4 text-sm font-bold text-destructive-foreground"
                >
                  <Trash2 className="size-4" aria-hidden="true" /> Remove
                </button>
              ) : (
                <>
                  <QtyStepper qty={r.qty} onChange={(q) => onQty(r.index, q)} label={r.name} removable size="sm" />
                  <span className="font-bold tabular-nums">{formatINR(r.lineTotal)}</span>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
