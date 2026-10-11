"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { MenuItem } from "@/data/menu";
import { formatINR } from "@/domain/money";
import { useCart } from "@/lib/cart";
import { QtyStepper } from "./QtyStepper";
import { ResponsiveSheet, SheetCloseButton, SheetDescription, SheetTitle } from "./ResponsiveSheet";
import { previewLines } from "./useOrderData";

export function CartDrawer({ open, onOpenChange, menu }: { open: boolean; onOpenChange: (o: boolean) => void; menu: MenuItem[] }) {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const rows = previewLines(lines, menu);
  const subtotal = rows.reduce((s, r) => s + r.lineTotal, 0);
  const count = lines.reduce((n, l) => n + l.qty, 0);

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} size="sm">
      <div className="flex items-center gap-3 px-5 pt-3 pb-3 sm:px-6 sm:pt-5">
        <div className="flex-1">
          <SheetTitle className="text-2xl font-bold text-primary">Your cart</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {count} {count === 1 ? "item" : "items"}
          </SheetDescription>
        </div>
        <SheetCloseButton className="-mr-2" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border px-5 sm:px-6">
        {rows.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingBag className="mx-auto size-10 text-line" aria-hidden="true" />
            <p className="mt-3 font-bold text-primary">Your cart is empty</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={`${r.itemId}-${r.index}`} className="flex items-start gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug">{r.name}</p>
                  {r.optionLabels.length > 0 && <p className="mt-0.5 text-sm text-muted-foreground">{r.optionLabels.join(", ")}</p>}
                  {r.note && <p className="mt-0.5 text-sm text-muted-foreground italic">“{r.note}”</p>}
                  <p className="mt-1 text-sm font-bold tabular-nums">{formatINR(r.lineTotal)}</p>
                </div>
                <QtyStepper qty={r.qty} onChange={(q) => setQty(r.index, q)} label={r.name} removable size="sm" />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-border bg-card px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-xl font-bold tabular-nums">{formatINR(subtotal)}</span>
        </div>
        <Link
          href="/checkout/"
          aria-disabled={rows.length === 0}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent font-bold text-accent-foreground shadow-card aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          Go to checkout
        </Link>
        <p className="mt-2 text-center text-xs text-muted-foreground">GST and any coupon or points are applied at checkout.</p>
      </div>
    </ResponsiveSheet>
  );
}
