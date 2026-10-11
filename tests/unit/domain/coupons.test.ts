import { describe, it, expect } from "vitest";
import { couponDiscount } from "@/domain/coupons";
import type { Coupon } from "@/domain/types";

const now = new Date(2026, 9, 13, 12, 0);
const c = (o: Partial<Coupon> = {}): Coupon => ({ code: "X", type: "percent", value: 10, minOrder: 0, maxDiscount: null, expiresAt: null, usageLimit: null, usedCount: 0, firstOrderOnly: false, active: true, ...o });

describe("couponDiscount", () => {
  it("percent", () => expect(couponDiscount(c(), 500, false, now)).toEqual({ ok: true, amount: 50 }));
  it("percent capped by maxDiscount", () => expect(couponDiscount(c({ value: 50, maxDiscount: 100 }), 1000, false, now)).toEqual({ ok: true, amount: 100 }));
  it("flat never exceeds subtotal", () => expect(couponDiscount(c({ type: "flat", value: 500 }), 120, false, now)).toEqual({ ok: true, amount: 120 }));
  it("expired", () => expect(couponDiscount(c({ expiresAt: new Date(2026, 9, 12).toISOString() }), 500, false, now)).toEqual({ ok: false, reason: "EXPIRED" }));
  it("not yet expired", () => expect(couponDiscount(c({ expiresAt: new Date(2026, 9, 14).toISOString() }), 500, false, now).ok).toBe(true));
  it("inactive", () => expect(couponDiscount(c({ active: false }), 500, false, now)).toEqual({ ok: false, reason: "INACTIVE" }));
  it("min order", () => expect(couponDiscount(c({ minOrder: 300 }), 299, false, now)).toEqual({ ok: false, reason: "MIN_ORDER" }));
  it("usage limit", () => expect(couponDiscount(c({ usageLimit: 5, usedCount: 5 }), 500, false, now)).toEqual({ ok: false, reason: "LIMIT" }));
  it("first order only", () => {
    expect(couponDiscount(c({ firstOrderOnly: true }), 500, false, now)).toEqual({ ok: false, reason: "FIRST_ORDER_ONLY" });
    expect(couponDiscount(c({ firstOrderOnly: true }), 500, true, now).ok).toBe(true);
  });
});
