"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cafe } from "@/data/cafe";
import { formatINR } from "@/domain/money";
import type { Order } from "@/store/DataStore";
import { dateTime, paymentTotals, whereLine } from "./format";

const noop = () => () => {};

/**
 * Print-only invoice. It is portalled to <body> so the print stylesheet (globals.css) can hide every
 * other body child with one rule; on screen it is display:none.
 */
export function Invoice({ order }: { order: Order }) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  const { bill } = order;
  const { paid, cashDue } = paymentTotals(order);
  const right = "text-right tabular-nums";
  const rows: [string, string][] = [
    ["Subtotal", formatINR(bill.subtotal)],
    ...(bill.couponDiscount > 0 ? [[`Coupon ${order.couponCode ?? ""}`.trim(), `−${formatINR(bill.couponDiscount)}`] as [string, string]] : []),
    ...(bill.loyaltyDiscount > 0 ? [[`Loyalty (${bill.pointsRedeemed} points)`, `−${formatINR(bill.loyaltyDiscount)}`] as [string, string]] : []),
    ["CGST 2.5%", formatINR(bill.cgst)],
    ["SGST 2.5%", formatINR(bill.sgst)],
  ];
  return createPortal(
    <section data-invoice aria-label="Invoice" className="invoice-print bg-card p-8 text-foreground">
      <header className="border-b-2 border-foreground pb-4">
        <h2 className="text-2xl font-bold">{cafe.name}</h2>
        <p className="text-sm">{cafe.address}</p>
        <p className="text-sm">Phone: {cafe.phone}</p>
        <p className="text-sm font-bold">GSTIN: to be added</p>
      </header>
      <div className="mt-4 flex justify-between gap-6 text-sm">
        <div>
          <p className="font-bold">Bill for order {order.code}</p>
          <p>{order.customerName}</p>
          <p>{whereLine(order)}</p>
        </div>
        <p className="text-right">{dateTime(order.createdAt)}</p>
      </div>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-foreground text-left">
            <th className="py-1 font-bold">Item</th>
            <th className="py-1 text-right font-bold">Qty</th>
            <th className="py-1 text-right font-bold">Rate</th>
            <th className="py-1 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.lines.map((l, i) => (
            <tr key={`${l.itemId}-${i}`} className="align-top">
              <td className="py-1">
                {l.name}
                {l.optionLabels.length > 0 && <span className="block text-xs">{l.optionLabels.join(", ")}</span>}
              </td>
              <td className={`py-1 ${right}`}>{l.qty}</td>
              <td className={`py-1 ${right}`}>{formatINR(l.unitPrice)}</td>
              <td className={`py-1 ${right}`}>{formatINR(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-3 ml-auto w-64 space-y-1 border-t border-foreground pt-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt>{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-foreground pt-1 text-base font-bold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatINR(bill.total)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm">
        Payment: {formatINR(paid)} paid{cashDue > 0 ? `, ${formatINR(cashDue)} due at the counter` : bill.total - paid <= 0 ? " (paid in full)" : ""}.
      </p>
      <p className="mt-6 text-center text-xs">Thank you for dining with us. Prices include GST at 5%.</p>
    </section>,
    document.body,
  );
}
