import type { Coupon } from "./types";

export function couponDiscount(
  c: Coupon,
  subtotal: number,
  isFirstOrder: boolean,
  now: Date,
): { ok: true; amount: number } | { ok: false; reason: "EXPIRED" | "INACTIVE" | "MIN_ORDER" | "LIMIT" | "FIRST_ORDER_ONLY" } {
  if (!c.active) return { ok: false, reason: "INACTIVE" };
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now.getTime()) return { ok: false, reason: "EXPIRED" };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { ok: false, reason: "LIMIT" };
  if (c.firstOrderOnly && !isFirstOrder) return { ok: false, reason: "FIRST_ORDER_ONLY" };
  if (subtotal < c.minOrder) return { ok: false, reason: "MIN_ORDER" };

  let amount = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
  if (c.maxDiscount !== null) amount = Math.min(amount, c.maxDiscount);
  return { ok: true, amount: Math.max(0, Math.min(amount, subtotal)) };
}
