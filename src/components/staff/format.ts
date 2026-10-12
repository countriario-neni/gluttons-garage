import { fmt12 } from "@/domain/slots";
import { formatINR } from "@/domain/money";
import type { Order } from "@/store/DataStore";

/** Cash still to collect at the counter: total − Σ successful payments − online payments still pending. */
export function cashDueOf(o: Order): number {
  const covered = o.payments.reduce(
    (s, p) => (p.status === "success" || (p.status === "pending" && p.method === "online") ? s + p.amount : s),
    0,
  );
  return Math.max(0, o.bill.total - covered);
}

/** Σ successful payments covers the total (the only state in which an order may be completed). */
export const isSettled = (o: Order): boolean => o.payments.reduce((s, p) => (p.status === "success" ? s + p.amount : s), 0) >= o.bill.total;

export type PaymentBadge = { label: string; tone: "paid" | "due" | "unpaid" };

export function paymentBadge(o: Order): PaymentBadge {
  const paid = o.payments.reduce((s, p) => (p.status === "success" ? s + p.amount : s), 0);
  if (paid >= o.bill.total) return { label: "Paid", tone: "paid" };
  if (paid > 0) return { label: `Partial ${formatINR(o.bill.total - paid)} due`, tone: "due" };
  const cash = cashDueOf(o);
  if (cash > 0) return { label: `Cash due ${formatINR(cash)}`, tone: "due" };
  return { label: "Unpaid", tone: "unpaid" };
}

/** "Table 3" or "Takeaway · 6:30 PM". */
export const placeLabel = (o: Pick<Order, "mode" | "table" | "pickupTime">) =>
  o.mode === "dine_in" ? `Table ${o.table}` : `Takeaway${o.pickupTime ? ` · ${fmt12(o.pickupTime)}` : ""}`;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** Whole minutes since `iso`, never negative. */
export const elapsedMinutes = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));

export const elapsedTone = (min: number): "ok" | "warn" | "late" => (min >= 20 ? "late" : min >= 10 ? "warn" : "ok");

/** "4 min", "1 h 05 min". */
export function elapsedLabel(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** Exact amount, then the next ₹50 / ₹100 / ₹500 notes above it, without duplicates. */
export function quickAmounts(due: number): number[] {
  const next = (step: number) => (Math.floor(due / step) + 1) * step;
  return [...new Set([due, next(50), next(100), next(500)])].sort((a, b) => a - b);
}

/** Midnight in café time (IST), as an ISO string, for the "today" query. */
export function cafeDayStartIso(now: number): string {
  const IST = 330 * 60_000;
  const DAY = 86_400_000;
  return new Date(Math.floor((now + IST) / DAY) * DAY - IST).toISOString();
}

const ERRORS: Record<string, string> = {
  BAD_TRANSITION: "Someone already updated this order on another screen. The board has been refreshed.",
  ORDER_CLOSED: "This order was rejected or cancelled, so it can't take a payment.",
  BAD_AMOUNT: "That amount doesn't match what's due any more. Check the order and try again.",
  UNAUTHENTICATED: "Your staff session has ended. Sign in again.",
  FORBIDDEN: "Only the owner can do that.",
  UNPAID: "This order isn't fully paid yet, so it can't be completed. Collect the payment first.",
  ORDER_NOT_FOUND: "This order no longer exists. The board has been refreshed.",
};

export const staffErrorCopy = (e: unknown) =>
  ERRORS[e instanceof Error ? e.message : String(e)] ?? "Something went wrong. Please try again.";

/** "New order GG-1234 · Table 3". */
export const newOrderLine = (o: Order) => `New order ${o.code} · ${placeLabel(o)}`;
