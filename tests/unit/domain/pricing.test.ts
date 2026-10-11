import { describe, it, expect } from "vitest";
import { priceOrder } from "@/domain/pricing";
import { formatINR, roundRupee } from "@/domain/money";
import type { MenuItem } from "@/data/menu";
import type { Coupon, CartLine } from "@/domain/types";

const item = (id: string, price: number, over: Partial<MenuItem> = {}): MenuItem => ({
  id, categoryId: "c", name: id, description: "", price, veg: true, egg: false, image: "", tags: [],
  options: [], available: true, ...over,
});
const menu: MenuItem[] = [
  item("a", 100),
  item("b", 200, {
    options: [
      { id: "b-cheese", group: "Add-ons", label: "Cheese", priceDelta: 20 },
      { id: "b-egg", group: "Add-ons", label: "Egg", priceDelta: 15 },
      { id: "b-reg", group: "Size", label: "Regular", priceDelta: 0 },
      { id: "b-lrg", group: "Size", label: "Large", priceDelta: 50 },
    ],
  }),
  item("off", 100, { available: false }),
];
const base = { menu, coupon: null, isFirstOrder: false, pointsToRedeem: 0, pointsBalance: 0, now: new Date(2026, 9, 13, 12, 0) };
const line = (itemId: string, qty = 1, optionIds: string[] = []): CartLine => ({ itemId, optionIds, qty });
const bill = (r: ReturnType<typeof priceOrder>) => { if (!r.ok) throw new Error(r.error); return r.bill; };
const coupon = (o: Partial<Coupon> = {}): Coupon => ({ code: "X", type: "flat", value: 50, minOrder: 0, maxDiscount: null, expiresAt: null, usageLimit: null, usedCount: 0, firstOrderOnly: false, active: true, ...o });

describe("priceOrder", () => {
  it("recomputes from menu, ignoring client price", () => {
    const tampered = { ...line("a", 2), price: 1, unitPrice: 1, lineTotal: 2 } as any;
    const b = bill(priceOrder({ ...base, lines: [tampered] }));
    expect(b.lines[0].unitPrice).toBe(100);
    expect(b.lines[0].lineTotal).toBe(200);
    expect(b.subtotal).toBe(200);
  });
  it("option deltas add to unit price; lineTotal = unit*qty", () => {
    const b = bill(priceOrder({ ...base, lines: [line("b", 3, ["b-cheese", "b-egg", "b-lrg"])] }));
    expect(b.lines[0].unitPrice).toBe(285);
    expect(b.lines[0].lineTotal).toBe(855);
    expect(b.lines[0].optionLabels).toEqual(["Cheese", "Egg", "Large"]);
  });
  it("GST 5% on taxable split 2.5/2.5, rounded to rupee; total = taxable + cgst + sgst", () => {
    const b = bill(priceOrder({ ...base, lines: [line("a", 2)] }));
    expect(b).toMatchObject({ taxable: 200, cgst: 5, sgst: 5, total: 210 });
    const c = bill(priceOrder({ ...base, lines: [line("a", 1), line("b", 1, ["b-egg"])] }));
    expect(c.taxable).toBe(315);
    expect(c.cgst + c.sgst).toBe(Math.round(315 * 0.05));
    expect(c.total).toBe(c.taxable + c.cgst + c.sgst);
  });
  it("rejects unavailable item", () => {
    expect(priceOrder({ ...base, lines: [line("off")] })).toEqual({ ok: false, error: "ITEM_UNAVAILABLE", itemId: "off" });
    expect(priceOrder({ ...base, lines: [line("nope")] })).toMatchObject({ ok: false, error: "ITEM_UNAVAILABLE" });
  });
  it("rejects empty cart", () => {
    expect(priceOrder({ ...base, lines: [] })).toMatchObject({ ok: false, error: "EMPTY_CART" });
  });
  it("rejects qty <1 or >50", () => {
    for (const q of [0, -1, 51, 1.5]) expect(priceOrder({ ...base, lines: [line("a", q)] })).toMatchObject({ ok: false, error: "BAD_QTY" });
    expect(priceOrder({ ...base, lines: [line("a", 50)] }).ok).toBe(true);
  });
  it("rejects options not belonging to the item or two from a single-choice group", () => {
    expect(priceOrder({ ...base, lines: [line("a", 1, ["b-cheese"])] })).toMatchObject({ ok: false, error: "BAD_OPTION" });
    expect(priceOrder({ ...base, lines: [line("b", 1, ["b-reg", "b-lrg"])] })).toMatchObject({ ok: false, error: "BAD_OPTION" });
    expect(priceOrder({ ...base, lines: [line("b", 1, ["b-cheese", "b-cheese"])] })).toMatchObject({ ok: false, error: "BAD_OPTION" });
  });
  it("applies coupon before tax", () => {
    const b = bill(priceOrder({ ...base, lines: [line("a", 4)], coupon: coupon({ value: 100 }) }));
    expect(b.couponDiscount).toBe(100);
    expect(b.taxable).toBe(300);
    expect(b.total).toBe(315);
  });
  it("coupon + loyalty never make total negative; loyalty capped at 50% of subtotal-coupon", () => {
    const b = bill(priceOrder({ ...base, lines: [line("a")], coupon: coupon({ value: 5000 }), pointsToRedeem: 10000, pointsBalance: 10000 }));
    expect(b.couponDiscount).toBe(100);
    expect(b.loyaltyDiscount).toBe(0);
    expect(b.total).toBe(0);
    const c = bill(priceOrder({ ...base, lines: [line("a", 4)], coupon: coupon({ value: 100 }), pointsToRedeem: 1000, pointsBalance: 1000 }));
    expect(c.loyaltyDiscount).toBe(150);
    expect(c.pointsRedeemed).toBe(300);
    expect(c.total).toBeGreaterThanOrEqual(0);
  });
  it("redeems only up to balance in blocks of 100 at Rs 50 per block", () => {
    const b = bill(priceOrder({ ...base, lines: [line("a", 10)], pointsToRedeem: 250, pointsBalance: 150 }));
    expect(b.pointsRedeemed).toBe(100);
    expect(b.loyaltyDiscount).toBe(50);
  });
  it("ignores an invalid coupon", () => {
    const b = bill(priceOrder({ ...base, lines: [line("a")], coupon: coupon({ active: false }) }));
    expect(b.couponDiscount).toBe(0);
  });
});

describe("money", () => {
  it("formats en-IN", () => {
    expect(formatINR(1234)).toBe("₹1,234");
    expect(formatINR(123456)).toBe("₹1,23,456");
    expect(formatINR(0)).toBe("₹0");
    expect(roundRupee(2.5)).toBe(3);
  });
});
