import type { SeedDB } from "@/data/seed";
import { tagsFor } from "@/domain/segments";
import type { Customer, CustomerStats, Order } from "../DataStore";

export type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

export const DB_KEY = "gg-demo-v1";
export const SESSION_KEY = "gg-demo-session";
export const CHANNEL_NAME = "gg-demo";

export const normPhone = (p: string): string => p.replace(/\D/g, "").slice(-10);

const DEAD = new Set<Order["status"]>(["rejected", "cancelled"]);

export const pointsBalance = (db: SeedDB, customerId: string): number =>
  db.ledger.reduce((s, l) => (l.customerId === customerId ? s + l.points : s), 0);

/** No previous non-rejected order for this customer. */
export const isFirstOrder = (db: SeedDB, customerId: string | undefined): boolean =>
  !customerId || !db.orders.some((o) => o.customerId === customerId && o.status !== "rejected");

export function paymentStatusOf(o: Order): Order["paymentStatus"] {
  const paid = o.payments.reduce((s, p) => (p.status === "success" ? s + p.amount : s), 0);
  return paid >= o.bill.total ? "paid" : paid > 0 ? "partial" : "unpaid";
}

export function customerStats(db: SeedDB, c: Customer, now: Date): CustomerStats {
  const mine = db.orders.filter((o) => o.customerId === c.id && !DEAD.has(o.status));
  const totalSpend = mine.reduce((s, o) => s + o.bill.total, 0);
  const lastOrderAt = mine.reduce<string | null>((m, o) => (m === null || o.createdAt > m ? o.createdAt : m), null);
  const qty = new Map<string, number>();
  for (const o of mine) for (const l of o.bill.lines) qty.set(l.name, (qty.get(l.name) ?? 0) + l.qty);
  const favourites = [...qty.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([name]) => name);
  return {
    ...c,
    orders: mine.length,
    totalSpend,
    lastOrderAt,
    avgBill: mine.length ? Math.round(totalSpend / mine.length) : 0,
    favourites,
    points: pointsBalance(db, c.id),
    tags: tagsFor({ orders: mine.length, totalSpend, lastOrderAt }, now),
  };
}

/** Newest first; ties (same timestamp) keep the most recently inserted first. */
export function newestFirst<T extends { createdAt: string }>(rows: T[]): T[] {
  return [...rows].reverse().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}
