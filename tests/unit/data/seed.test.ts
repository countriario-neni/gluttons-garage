import { describe, it, expect } from "vitest";
import { generateSeed } from "@/data/seed";
import { items } from "@/data/menu";
import { priceOrder } from "@/domain/pricing";
import { pointsEarned } from "@/domain/loyalty";

const NOW = new Date("2026-10-11T08:30:00.000Z");

describe("generateSeed", () => {
  const db = generateSeed(NOW);

  it("is deterministic for the same now", () => {
    expect(generateSeed(NOW)).toEqual(db);
  });

  it("has 40 customers with sample phones and ~85% opted in", () => {
    expect(db.customers).toHaveLength(40);
    for (const c of db.customers) expect(c.phone).toMatch(/^90000\d{5}$/);
    expect(new Set(db.customers.map((c) => c.phone)).size).toBe(40);
    const opted = db.customers.filter((c) => c.marketingOptIn).length;
    expect(opted).toBeGreaterThan(26);
    expect(opted).toBeLessThan(40);
  });

  it("creates ~21 days of orders with sequential codes, nextCode after the last", () => {
    expect(db.orders.length).toBeGreaterThan(200);
    db.orders.forEach((o, i) => expect(o.code).toBe(`GG-${1001 + i}`));
    expect(db.nextCode).toBe(1001 + db.orders.length);
    for (const o of db.orders) expect(new Date(o.createdAt).getTime()).toBeLessThanOrEqual(NOW.getTime());
  });

  it("every order bill equals a priceOrder recomputation", () => {
    for (const o of db.orders) {
      const cust = db.customers.find((c) => c.id === o.customerId)!;
      expect(cust.phone).toBe(o.phone);
      const r = priceOrder({
        lines: o.bill.lines.map((l) => ({ itemId: l.itemId, optionIds: l.optionIds, qty: l.qty })),
        menu: items,
        coupon: null,
        isFirstOrder: false,
        pointsToRedeem: 0,
        pointsBalance: 0,
        now: NOW,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.bill.subtotal).toBe(o.bill.subtotal);
        const taxable = o.bill.subtotal - o.bill.couponDiscount - o.bill.loyaltyDiscount;
        expect(o.bill.taxable).toBe(taxable);
        expect(o.bill.total).toBe(o.bill.taxable + o.bill.cgst + o.bill.sgst);
      }
    }
  });

  it("completed orders are fully paid with consistent payments; rejected are a few percent", () => {
    for (const o of db.orders) {
      if (["placed", "preparing", "ready"].includes(o.status)) continue; // live orders, tested separately
      if (o.status === "completed") {
        expect(o.paymentStatus).toBe("paid");
        expect(o.payments.every((p) => p.status === "success")).toBe(true);
        expect(o.payments.reduce((s, p) => s + p.amount, 0)).toBe(o.bill.total);
        if (o.mode === "takeaway") expect(o.payments.every((p) => p.method === "online")).toBe(true);
      } else expect(o.status).toBe("rejected");
    }
    const rejected = db.orders.filter((o) => o.status === "rejected").length;
    expect(rejected).toBeGreaterThan(0);
    expect(rejected / db.orders.length).toBeLessThan(0.08);
  });

  it("ledger sums to earned minus redeemed per customer, never negative", () => {
    const earned = new Map<string, number>();
    const redeemed = new Map<string, number>();
    for (const o of db.orders) {
      if (o.status === "completed") earned.set(o.customerId, (earned.get(o.customerId) ?? 0) + pointsEarned(o.bill.total));
      redeemed.set(o.customerId, (redeemed.get(o.customerId) ?? 0) + o.bill.pointsRedeemed);
    }
    for (const c of db.customers) {
      const sum = db.ledger.filter((l) => l.customerId === c.id).reduce((s, l) => s + l.points, 0);
      expect(sum).toBe((earned.get(c.id) ?? 0) - (redeemed.get(c.id) ?? 0));
      expect(sum).toBeGreaterThanOrEqual(0);
    }
    expect(db.ledger.some((l) => l.reason === "redeem")).toBe(true);
  });

  it("has at least 5 inactive customers (only orders 35-60 days old)", () => {
    const cutoff = NOW.getTime() - 30 * 86400000;
    const inactive = db.customers.filter((c) => {
      const mine = db.orders.filter((o) => o.customerId === c.id && o.status !== "rejected");
      return mine.length > 0 && mine.every((o) => new Date(o.createdAt).getTime() < cutoff);
    });
    expect(inactive.length).toBeGreaterThanOrEqual(5);
    const oldest = Math.min(...db.orders.map((o) => new Date(o.createdAt).getTime()));
    expect(NOW.getTime() - oldest).toBeLessThanOrEqual(61 * 86400000);
  });

  it("seeds exactly 3 live orders for the kitchen board", () => {
    const live = db.orders.filter((o) => !["completed", "rejected", "cancelled"].includes(o.status));
    expect(live.map((o) => o.status).sort()).toEqual(["placed", "preparing", "ready"]);
    const by = (s: string) => live.find((o) => o.status === s)!;
    expect(by("placed")).toMatchObject({ mode: "dine_in", table: 3, paymentStatus: "paid" });
    expect(by("placed").payments.every((p) => p.method === "online" && p.status === "success")).toBe(true);
    expect(by("preparing")).toMatchObject({ mode: "takeaway", paymentStatus: "paid" });
    const [h, m] = by("preparing").pickupTime!.split(":").map(Number);
    const istNow = new Date(NOW.getTime() + 330 * 60000);
    const diff = h * 60 + m - (istNow.getUTCHours() * 60 + istNow.getUTCMinutes());
    expect(diff).toBeGreaterThanOrEqual(25);
    expect(diff).toBeLessThanOrEqual(35);
    const ready = by("ready");
    expect(ready).toMatchObject({ mode: "dine_in", table: 6, paymentStatus: "partial" });
    expect(ready.payments.map((p) => [p.method, p.status])).toEqual([["online", "success"], ["cash", "pending"]]);
  });

  it("has the three coupons, GG100 expired, usedCount matching orders", () => {
    expect(db.coupons.map((c) => c.code)).toEqual(["WELCOME10", "TIRAMISU50", "GG100"]);
    expect(new Date(db.coupons[2].expiresAt!).getTime()).toBeLessThan(NOW.getTime());
    for (const c of db.coupons) expect(db.orders.filter((o) => o.couponCode === c.code).length).toBe(c.usedCount);
  });

  it("includes settings, staff and a menu copy", () => {
    expect(db.items).toHaveLength(items.length);
    expect(db.items).not.toBe(items);
    expect(db.settings.tables).toBe(10);
    expect(db.staff.map((s) => s.role)).toEqual(["owner", "kitchen"]);
  });
});
