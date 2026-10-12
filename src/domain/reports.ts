import type { Order } from "@/store/DataStore";
import type { OrderMode } from "./types";

export type Range = { from: Date; to: Date };
export type Summary = {
  revenue: number;
  orders: number;
  aov: number;
  byHour: { hour: number; orders: number; revenue: number }[];
  byDay: { date: string; revenue: number; orders: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  byMode: Record<OrderMode, number>;
  byPayment: { online: number; cash: number; split: number };
  couponDiscount: number;
  loyaltyDiscount: number;
};

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar day as YYYY-MM-DD. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Revenue only ever counts orders that were completed AND fully paid. */
export const countsTowardRevenue = (o: Order) => o.status === "completed" && o.paymentStatus === "paid";

/** online = only online money, cash = only counter cash, split = both. */
export function paymentKind(o: Order): "online" | "cash" | "split" {
  const ok = o.payments.filter((p) => p.status === "success");
  const online = ok.some((p) => p.method === "online");
  const cash = ok.some((p) => p.method === "cash");
  return online && cash ? "split" : cash ? "cash" : "online";
}

export function summarize(orders: Order[], range: Range): Summary {
  const from = range.from.getTime();
  const to = range.to.getTime();
  const mine = orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return countsTowardRevenue(o) && t >= from && t <= to;
  });

  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
  const days = new Map<string, { date: string; revenue: number; orders: number }>();
  const first = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
  for (let d = first; d.getTime() <= to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.set(dayKey(d), { date: dayKey(d), revenue: 0, orders: 0 });
  }
  const items = new Map<string, { name: string; qty: number; revenue: number }>();
  const byMode: Record<OrderMode, number> = { dine_in: 0, takeaway: 0 };
  const byPayment = { online: 0, cash: 0, split: 0 };
  let revenue = 0;
  let couponDiscount = 0;
  let loyaltyDiscount = 0;

  for (const o of mine) {
    const at = new Date(o.createdAt);
    const total = o.bill.total;
    revenue += total;
    couponDiscount += o.bill.couponDiscount;
    loyaltyDiscount += o.bill.loyaltyDiscount;
    byHour[at.getHours()].orders += 1;
    byHour[at.getHours()].revenue += total;
    const day = days.get(dayKey(at)) ?? { date: dayKey(at), revenue: 0, orders: 0 };
    day.orders += 1;
    day.revenue += total;
    days.set(day.date, day);
    byMode[o.mode] += 1;
    byPayment[paymentKind(o)] += 1;
    for (const l of o.bill.lines) {
      const row = items.get(l.name) ?? { name: l.name, qty: 0, revenue: 0 };
      row.qty += l.qty;
      row.revenue += l.lineTotal;
      items.set(l.name, row);
    }
  }

  return {
    revenue,
    orders: mine.length,
    aov: mine.length ? Math.round(revenue / mine.length) : 0,
    byHour,
    byDay: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    topItems: [...items.values()].sort((a, b) => b.revenue - a.revenue || b.qty - a.qty || a.name.localeCompare(b.name)),
    byMode,
    byPayment,
    couponDiscount,
    loyaltyDiscount,
  };
}

/** The equal-length period immediately before `range`. */
export function previousRange(range: Range): Range {
  const len = range.to.getTime() - range.from.getTime() + 1;
  return { from: new Date(range.from.getTime() - len), to: new Date(range.from.getTime() - 1) };
}

/** Percentage change vs the previous period; null when there is nothing to compare against. */
export const deltaPercent = (now: number, before: number): number | null =>
  before === 0 ? null : Math.round(((now - before) / before) * 100);

/** One CSV cell: strings starting with = + - @ get a leading ' (spreadsheet formula injection), then RFC 4180 quoting. */
function cell(v: string | number | null): string {
  if (v === null) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export const CSV_HEADER = [
  "Order",
  "Placed at",
  "Customer",
  "Phone",
  "Mode",
  "Table",
  "Status",
  "Payment status",
  "Subtotal",
  "Coupon discount",
  "Loyalty discount",
  "GST",
  "Total",
  "Items",
];

export function toCsv(orders: Order[]): string {
  const rows = orders.map((o) => [
    o.code,
    o.createdAt,
    o.customerName,
    o.phone,
    o.mode === "dine_in" ? "Dine-in" : "Takeaway",
    o.table,
    o.status,
    o.paymentStatus,
    o.bill.subtotal,
    o.bill.couponDiscount,
    o.bill.loyaltyDiscount,
    o.bill.cgst + o.bill.sgst,
    o.bill.total,
    o.bill.lines.map((l) => `${l.qty} x ${l.name}`).join("; "),
  ]);
  return [CSV_HEADER, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
