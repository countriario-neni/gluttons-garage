import { describe, expect, test } from "vitest";
import {
  cafeDayStartIso,
  cashDueOf,
  elapsedLabel,
  elapsedTone,
  isSettled,
  paymentBadge,
  placeLabel,
  quickAmounts,
  staffErrorCopy,
} from "@/components/staff/format";
import type { Order, Payment } from "@/store/DataStore";

const pay = (p: Partial<Payment>): Payment => ({
  id: "p",
  method: "online",
  channel: "upi_qr",
  amount: 0,
  status: "success",
  reference: null,
  createdAt: "",
  ...p,
});
const order = (total: number, payments: Payment[]): Order =>
  ({ bill: { total }, payments, mode: "dine_in", table: 4, pickupTime: null }) as unknown as Order;

describe("payment badge and cash due", () => {
  test("fully paid online", () => {
    const o = order(500, [pay({ amount: 500 })]);
    expect(paymentBadge(o)).toEqual({ label: "Paid", tone: "paid" });
    expect(cashDueOf(o)).toBe(0);
  });
  test("split with cash pending is partial and the cash part is due", () => {
    const o = order(1200, [pay({ amount: 400 }), pay({ method: "cash", channel: "cash", amount: 800, status: "pending" })]);
    expect(paymentBadge(o).label).toBe("Partial ₹800 due");
    expect(cashDueOf(o)).toBe(800);
  });
  test("a pending online payment is not settled (Complete stays blocked)", () => {
    const o = order(500, [pay({ amount: 500, status: "pending" })]);
    expect(cashDueOf(o)).toBe(0);
    expect(isSettled(o)).toBe(false);
    expect(isSettled(order(500, [pay({ amount: 500 })]))).toBe(true);
    expect(staffErrorCopy(new Error("UNPAID"))).toMatch(/fully paid/);
  });
  test("cash order before settling", () => {
    const o = order(1500, [pay({ method: "cash", channel: "cash", amount: 1500, status: "pending" })]);
    expect(paymentBadge(o).label).toBe("Cash due ₹1,500");
    expect(cashDueOf(o)).toBe(1500);
  });
  test("online payment still pending is unpaid with no cash due", () => {
    const o = order(300, [pay({ amount: 300, status: "pending", channel: "pending" })]);
    expect(paymentBadge(o)).toEqual({ label: "Unpaid", tone: "unpaid" });
    expect(cashDueOf(o)).toBe(0);
  });
});

test("quick amounts: exact, then the next 50/100/500 without duplicates", () => {
  expect(quickAmounts(432)).toEqual([432, 450, 500]);
  expect(quickAmounts(560)).toEqual([560, 600, 1000]);
  expect(quickAmounts(500)).toEqual([500, 550, 600, 1000]);
});

test("elapsed tone thresholds", () => {
  expect([0, 9, 10, 19, 20].map(elapsedTone)).toEqual(["ok", "ok", "warn", "warn", "late"]);
  expect(elapsedLabel(7)).toBe("7 min");
  expect(elapsedLabel(65)).toBe("1 h 05 min");
});

test("place label", () => {
  expect(placeLabel({ mode: "dine_in", table: 3, pickupTime: null })).toBe("Table 3");
  expect(placeLabel({ mode: "takeaway", table: null, pickupTime: "18:30" })).toBe("Takeaway · 6:30 PM");
});

test("café day starts at IST midnight", () => {
  expect(cafeDayStartIso(new Date("2026-10-13T12:00:00+05:30").getTime())).toBe("2026-10-12T18:30:00.000Z");
  expect(cafeDayStartIso(new Date("2026-10-13T00:10:00+05:30").getTime())).toBe("2026-10-12T18:30:00.000Z");
});

test("friendly error copy", () => {
  expect(staffErrorCopy(new Error("BAD_TRANSITION"))).toMatch(/another screen/);
  expect(staffErrorCopy(new Error("ORDER_CLOSED"))).toMatch(/rejected or cancelled/);
  expect(staffErrorCopy(new Error("BAD_AMOUNT"))).toMatch(/amount/);
  expect(staffErrorCopy(new Error("UNAUTHENTICATED"))).toMatch(/sign in again/i);
  expect(staffErrorCopy(new Error("weird"))).toMatch(/something went wrong/i);
});
