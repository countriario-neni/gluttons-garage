import { fmt12 } from "@/domain/slots";
import type { Order } from "@/store/DataStore";

const tz = "Asia/Kolkata";

/** "6:42 PM", in café time. */
export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).toUpperCase();

/** "12 Oct 2026, 6:42 PM", in café time. */
export const dateTime = (iso: string) =>
  `${new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: tz })}, ${clockTime(iso)}`;

/** "Dine-in · Table 4" or "Takeaway · Pickup at 6:30 PM". */
export const whereLine = (o: Pick<Order, "mode" | "table" | "pickupTime">) =>
  o.mode === "dine_in" ? `Dine-in · Table ${o.table}` : `Takeaway · Pickup at ${o.pickupTime ? fmt12(o.pickupTime) : "your slot"}`;

/** Money received, still due at the counter, and online still pending. */
export function paymentTotals(o: Order) {
  const sum = (f: (p: Order["payments"][number]) => boolean) => o.payments.filter(f).reduce((s, p) => s + p.amount, 0);
  return {
    paid: sum((p) => p.status === "success"),
    cashDue: sum((p) => p.method === "cash" && p.status === "pending"),
    onlinePending: sum((p) => p.method === "online" && p.status === "pending"),
  };
}
