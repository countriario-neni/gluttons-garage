import { describe, expect, it } from "vitest";
import { inSegment, tagsFor } from "@/domain/segments";
import type { CustomerStats } from "@/store/DataStore";

const NOW = new Date("2026-10-13T12:00:00+05:30");
const daysAgo = (d: number, extraMs = 0) => new Date(NOW.getTime() - d * 86_400_000 - extraMs).toISOString();
const act = (orders: number, totalSpend = 100, lastOrderAt: string | null = daysAgo(1)) => ({ orders, totalSpend, lastOrderAt });

describe("tagsFor", () => {
  it("has no tags without orders", () => expect(tagsFor(act(0, 0, null), NOW)).toEqual([]));
  it("new = exactly one order", () => {
    expect(tagsFor(act(1), NOW)).toEqual(["new"]);
    expect(tagsFor(act(2), NOW)).toEqual([]);
  });
  it("regular starts at 3 orders (2 vs 3)", () => {
    expect(tagsFor(act(2), NOW)).not.toContain("regular");
    expect(tagsFor(act(3), NOW)).toEqual(["regular"]);
  });
  it("vip at ₹5,000 spend (4,999 vs 5,000) or 8 orders (7 vs 8)", () => {
    expect(tagsFor(act(2, 4999), NOW)).not.toContain("vip");
    expect(tagsFor(act(2, 5000), NOW)).toContain("vip");
    expect(tagsFor(act(7, 100), NOW)).not.toContain("vip");
    expect(tagsFor(act(8, 100), NOW)).toContain("vip");
    expect(tagsFor(act(8, 5000), NOW)).toEqual(["regular", "vip"]);
  });
  it("inactive only after more than 30 days (30 vs 31)", () => {
    expect(tagsFor(act(2, 100, daysAgo(30)), NOW)).not.toContain("inactive");
    expect(tagsFor(act(2, 100, daysAgo(30, 1)), NOW)).toContain("inactive");
    expect(tagsFor(act(2, 100, daysAgo(31)), NOW)).toContain("inactive");
  });
  it("inactive takes precedence over new", () => {
    expect(tagsFor(act(1, 100, daysAgo(31)), NOW)).toEqual(["inactive"]);
    expect(tagsFor(act(1, 100, daysAgo(30)), NOW)).toEqual(["new"]);
  });
  it("a lapsed regular is regular and inactive", () => {
    expect(tagsFor(act(3, 100, daysAgo(45)), NOW)).toEqual(["regular", "inactive"]);
  });
});

describe("inSegment", () => {
  const cust = (o: Partial<CustomerStats>): CustomerStats => ({
    id: "c", phone: "9876543210", name: "A", marketingOptIn: true, notes: "", createdAt: daysAgo(100),
    orders: 1, totalSpend: 100, lastOrderAt: daysAgo(1), avgBill: 100, favourites: [], points: 0, tags: [], ...o,
  });

  it("requires opt-in for every segment", () => {
    for (const seg of ["all_opted_in", "new", "regular", "vip", "inactive_30d"] as const) {
      expect(inSegment(cust({ marketingOptIn: false, orders: 9, totalSpend: 9000, lastOrderAt: daysAgo(40) }), seg, NOW)).toBe(false);
    }
  });
  it("matches opted-in customers by recomputed tags", () => {
    expect(inSegment(cust({}), "all_opted_in", NOW)).toBe(true);
    expect(inSegment(cust({}), "new", NOW)).toBe(true);
    expect(inSegment(cust({}), "regular", NOW)).toBe(false);
    expect(inSegment(cust({ orders: 3 }), "regular", NOW)).toBe(true);
    expect(inSegment(cust({ totalSpend: 5000 }), "vip", NOW)).toBe(true);
    expect(inSegment(cust({ lastOrderAt: daysAgo(31) }), "inactive_30d", NOW)).toBe(true);
    expect(inSegment(cust({ lastOrderAt: daysAgo(30) }), "inactive_30d", NOW)).toBe(false);
    expect(inSegment(cust({ lastOrderAt: daysAgo(31) }), "new", NOW)).toBe(false);
  });
});
