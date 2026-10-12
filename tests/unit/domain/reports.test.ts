import { describe, expect, test } from "vitest";
import { deltaPercent, previousRange, summarize, toCsv } from "@/domain/reports";
import type { Order, Payment } from "@/store/DataStore";

const local = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const pay = (method: "online" | "cash", amount: number): Payment => ({
  id: `p${method}${amount}`,
  method,
  channel: method === "cash" ? "cash" : "upi_qr",
  amount,
  status: "success",
  reference: null,
  createdAt: "",
});
const line = (name: string, qty: number, lineTotal: number) => ({ itemId: name, optionIds: [], qty, name, unitPrice: lineTotal / qty, lineTotal, optionLabels: [] });

function order(p: {
  code: string;
  at: string;
  total: number;
  mode?: Order["mode"];
  status?: Order["status"];
  paymentStatus?: Order["paymentStatus"];
  payments?: Payment[];
  lines?: ReturnType<typeof line>[];
  coupon?: number;
  loyalty?: number;
  name?: string;
}): Order {
  return {
    id: p.code,
    code: p.code,
    customerId: "c",
    customerName: p.name ?? "Asha",
    phone: "9876543210",
    mode: p.mode ?? "dine_in",
    table: p.mode === "takeaway" ? null : 3,
    pickupTime: null,
    status: p.status ?? "completed",
    paymentStatus: p.paymentStatus ?? "paid",
    payments: p.payments ?? [pay("online", p.total)],
    createdAt: p.at,
    updatedAt: p.at,
    couponCode: null,
    bill: {
      lines: p.lines ?? [line("Fruit Salad", 1, p.total)],
      subtotal: p.total,
      couponDiscount: p.coupon ?? 0,
      loyaltyDiscount: p.loyalty ?? 0,
      pointsRedeemed: 0,
      taxable: p.total,
      cgst: 0,
      sgst: 0,
      total: p.total,
    },
  };
}

const fixture: Order[] = [
  order({ code: "A1", at: local(13, 9, 15), total: 200, lines: [line("Latte", 2, 200)], coupon: 20 }),
  order({ code: "A2", at: local(13, 9, 50), total: 300, mode: "takeaway", lines: [line("Latte", 1, 100), line("Brownie", 2, 200)], loyalty: 50 }),
  order({ code: "A3", at: local(13, 14, 5), total: 400, payments: [pay("online", 150), pay("cash", 250)] }),
  order({ code: "A4", at: local(13, 14, 30), total: 500, payments: [pay("cash", 500)] }),
  order({ code: "A5", at: local(13, 15, 0), total: 900, status: "rejected", paymentStatus: "unpaid", payments: [] }),
];
const day = { from: new Date(2026, 9, 13, 0, 0), to: new Date(2026, 9, 13, 23, 59, 59, 999) };

describe("summarize", () => {
  const s = summarize(fixture, day);

  test("revenue and AOV exclude rejected and unpaid orders", () => {
    expect(s.revenue).toBe(1400);
    expect(s.orders).toBe(4);
    expect(s.aov).toBe(350);
  });
  test("completed but unpaid does not count", () => {
    const o = order({ code: "U", at: local(13, 10), total: 777, paymentStatus: "partial" });
    expect(summarize([o], day).revenue).toBe(0);
  });
  test("split vs online vs cash classification", () => {
    expect(s.byPayment).toEqual({ online: 2, cash: 1, split: 1 });
  });
  test("mode counts", () => {
    expect(s.byMode).toEqual({ dine_in: 3, takeaway: 1 });
  });
  test("byHour buckets in local time", () => {
    expect(s.byHour).toHaveLength(24);
    expect(s.byHour[9]).toEqual({ hour: 9, orders: 2, revenue: 500 });
    expect(s.byHour[14]).toEqual({ hour: 14, orders: 2, revenue: 900 });
    expect(s.byHour[15].orders).toBe(0);
  });
  test("byDay zero-fills every day in range", () => {
    const week = summarize(fixture, { from: new Date(2026, 9, 11), to: new Date(2026, 9, 13, 23, 59, 59, 999) });
    expect(week.byDay.map((d) => d.date)).toEqual(["2026-10-11", "2026-10-12", "2026-10-13"]);
    expect(week.byDay.map((d) => d.revenue)).toEqual([0, 0, 1400]);
  });
  test("top items aggregate qty and revenue, best revenue first", () => {
    expect(s.topItems[0]).toEqual({ name: "Fruit Salad", qty: 2, revenue: 900 });
    expect(s.topItems.find((i) => i.name === "Latte")).toEqual({ name: "Latte", qty: 3, revenue: 300 });
  });
  test("discount totals", () => {
    expect(s.couponDiscount).toBe(20);
    expect(s.loyaltyDiscount).toBe(50);
  });
  test("orders outside the range are ignored", () => {
    expect(summarize(fixture, { from: new Date(2026, 9, 14), to: new Date(2026, 9, 14, 23, 59) }).orders).toBe(0);
  });
});

describe("period comparison", () => {
  test("previousRange is the equal-length period just before", () => {
    const p = previousRange(day);
    expect(p.to.getTime()).toBe(day.from.getTime() - 1);
    expect(p.to.getTime() - p.from.getTime()).toBe(day.to.getTime() - day.from.getTime());
  });
  test("deltaPercent", () => {
    expect(deltaPercent(150, 100)).toBe(50);
    expect(deltaPercent(50, 100)).toBe(-50);
    expect(deltaPercent(10, 0)).toBeNull();
  });
});

describe("toCsv", () => {
  test("header row plus one row per order", () => {
    const lines = toCsv(fixture).trimEnd().split("\r\n");
    expect(lines).toHaveLength(6);
    expect(lines[0]).toMatch(/^Order,Placed at,Customer,Phone,Mode,/);
    expect(lines[1]).toMatch(/^A1,/);
  });
  test("escapes commas, quotes and newlines", () => {
    const csv = toCsv([order({ code: "E", at: local(13, 9), total: 100, name: 'Rao, "Asha"\nJr', lines: [line("Mac, Cheese", 1, 100)] })]);
    expect(csv).toContain('"Rao, ""Asha""\nJr"');
    expect(csv).toContain('"1 x Mac, Cheese"');
  });
  test("neutralises spreadsheet formulas", () => {
    const csv = toCsv([order({ code: "F", at: local(13, 9), total: 100, name: "=HYPERLINK(\"x\")" })]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    for (const bad of ["+1", "-2", "@x"]) expect(toCsv([order({ code: "F", at: local(13, 9), total: 1, name: bad })])).toContain(`'${bad}`);
  });
});
