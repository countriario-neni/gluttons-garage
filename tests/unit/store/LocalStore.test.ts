import { describe, it, expect, beforeEach } from "vitest";
import { LocalStore } from "@/store/local/LocalStore";
import { items } from "@/data/menu";
import { pointsEarned } from "@/domain/loyalty";
import type { PlaceOrderInput, PlaceOrderResult } from "@/store/DataStore";

const NOW = new Date("2026-10-11T08:30:00.000Z");

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
type Ch = { postMessage: (m: unknown) => void; onmessage: ((e: { data: unknown }) => void) | null };
function channelPair(): [Ch, Ch] {
  const a: Ch = { postMessage: (m) => b.onmessage?.({ data: m }), onmessage: null };
  const b: Ch = { postMessage: (m) => a.onmessage?.({ data: m }), onmessage: null };
  return [a, b];
}
let counter = 0;
const newId = () => `id-${++counter}`;
function make(storage = memoryStorage(), channel: Ch | null = null, session = memoryStorage()) {
  return new LocalStore({ storage, channel, session, now: () => NOW, newId });
}

const cheap = items.find((i) => i.price >= 100 && i.price <= 150)!;
const pricey = items.find((i) => i.price >= 250 && i.price <= 320)!;
const PHONE = "9876543210";
const input = (over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  idempotencyKey: "k-" + ++counter,
  name: "Test Guest",
  phone: PHONE,
  marketingOptIn: true,
  mode: "dine_in",
  table: 3,
  pickupTime: null,
  lines: [{ itemId: cheap.id, optionIds: [], qty: 2 }],
  couponCode: null,
  pointsToRedeem: 0,
  plan: { kind: "online" },
  ...over,
});
const ok = (r: PlaceOrderResult) => {
  if (!r.ok) throw new Error("expected ok, got " + r.error);
  return r;
};
const owner = async (s: LocalStore) => void (await s.staffSignIn("owner@gluttonsgarage.demo", "garage123"));
const maxCode = async (s: LocalStore) => Math.max(...(await s.listOrders({})).map((o) => Number(o.code.slice(3))));
/** A seeded customer with a healthy points balance. */
const richCustomer = async (s: LocalStore) => (await s.listCustomers()).find((c) => c.points >= 300)!;

let store: LocalStore;
beforeEach(() => {
  counter = 0;
  store = make();
});

describe("placeOrder", () => {
  it("stores order, upserts customer by phone, writes 2 message logs", async () => {
    const max = await maxCode(store);
    const r = ok(await store.placeOrder(input({ phone: "+91 98765 43210" })));
    expect(r.order.status).toBe("placed");
    expect(r.order.paymentStatus).toBe("unpaid");
    expect(r.order.phone).toBe(PHONE);
    expect(r.order.code).toBe("GG-" + (max + 1));
    expect(r.onlineDue).toBe(r.order.bill.total);
    expect(await store.getOrder(r.order.id)).toEqual(r.order);
    const custs = (await store.listCustomers()).filter((c) => c.phone === PHONE);
    expect(custs).toHaveLength(1);
    expect(custs[0].orders).toBe(1);
    const msgs = await store.listMessages({ orderId: r.order.id });
    expect(msgs.map((m) => m.direction).sort()).toEqual(["to_cafe", "to_customer"]);
    expect(msgs.find((m) => m.direction === "to_customer")!.to).toBe(PHONE);
    // second order by same phone reuses the customer; code increments
    const r2 = ok(await store.placeOrder(input()));
    expect((await store.listCustomers()).filter((c) => c.phone === PHONE)).toHaveLength(1);
    expect(r2.order.code).toBe("GG-" + (max + 2));
  });

  it("is idempotent on idempotencyKey", async () => {
    const i = input();
    const a = ok(await store.placeOrder(i));
    const b = ok(await store.placeOrder(i));
    expect(b.order.id).toBe(a.order.id);
    expect(b.onlineDue).toBe(a.onlineDue);
    expect((await store.listMessages({ orderId: a.order.id })).length).toBe(2);
  });

  it("recomputes bill from the menu (ignores tampered client price)", async () => {
    const tampered = { itemId: cheap.id, optionIds: [], qty: 1, price: 1 } as never;
    const r = ok(await store.placeOrder(input({ lines: [tampered] })));
    expect(r.order.bill.subtotal).toBe(cheap.price);
  });

  it.each([
    ["NOT_ACCEPTING", async (s: LocalStore) => { await owner(s); await s.updateSettings({ acceptingOrders: false }); return {}; }],
    ["BAD_PHONE", async () => ({ phone: "12345" })],
    ["BAD_NAME", async () => ({ name: "   " })],
    ["BAD_NAME", async () => ({ name: "x".repeat(61) })],
    ["BAD_TABLE", async () => ({ table: null })],
    ["BAD_TABLE", async () => ({ table: 11 })],
    ["BAD_TABLE", async () => ({ table: 2.5 })],
    ["BAD_PICKUP", async () => ({ mode: "takeaway" as const, table: null, pickupTime: null })],
    ["CASH_DINE_IN_ONLY", async () => ({ mode: "takeaway" as const, table: null, pickupTime: "13:00", plan: { kind: "cash" as const } })],
    ["CASH_DINE_IN_ONLY", async () => ({ mode: "takeaway" as const, table: null, pickupTime: "13:00", plan: { kind: "split" as const, onlineAmount: 50 } })],
    ["BAD_SPLIT", async () => ({ plan: { kind: "split" as const, onlineAmount: 0 } })],
    ["BAD_SPLIT", async () => ({ plan: { kind: "split" as const, onlineAmount: 100000 } })],
    ["BAD_POINTS", async () => ({ pointsToRedeem: 50 })],
    ["BAD_POINTS", async () => ({ pointsToRedeem: -100 })],
    ["BAD_POINTS", async () => ({ pointsToRedeem: Number.NaN })],
    ["BAD_POINTS", async () => ({ pointsToRedeem: 100 })], // new phone, balance is 0
    ["COUPON_NOT_FOUND", async () => ({ couponCode: "NOPE" })],
    ["COUPON_EXPIRED", async () => ({ couponCode: "GG100", lines: [{ itemId: pricey.id, optionIds: [], qty: 3 }] })],
    ["COUPON_MIN_ORDER", async () => ({ couponCode: "TIRAMISU50", lines: [{ itemId: cheap.id, optionIds: [], qty: 1 }] })],
    ["EMPTY_CART", async () => ({ lines: [] })],
    ["ITEM_UNAVAILABLE", async () => ({ lines: [{ itemId: "ghost", optionIds: [], qty: 1 }] })],
    ["BAD_QTY", async () => ({ lines: [{ itemId: cheap.id, optionIds: [], qty: 0 }] })],
    ["BAD_OPTION", async () => ({ lines: [{ itemId: cheap.id, optionIds: ["nope"], qty: 1 }] })],
  ] as const)("rejects with %s", async (code, setup) => {
    const over = await setup(store);
    const before = (await store.listOrders({})).length;
    const r = await store.placeOrder(input(over as Partial<PlaceOrderInput>));
    expect(r).toEqual({ ok: false, error: code });
    expect((await store.listOrders({})).length).toBe(before);
  });

  it("coupons are case-insensitive and usedCount increments", async () => {
    const before = (await store.listCoupons()).find((c) => c.code === "WELCOME10")!.usedCount;
    const r = ok(await store.placeOrder(input({ couponCode: " welcome10 ", phone: "9123456780" })));
    expect(r.order.couponCode).toBe("WELCOME10");
    expect(r.order.bill.couponDiscount).toBeGreaterThan(0);
    expect((await store.listCoupons()).find((c) => c.code === "WELCOME10")!.usedCount).toBe(before + 1);
    // second order: no longer first order
    const again = await store.placeOrder(input({ couponCode: "WELCOME10", phone: "9123456780" }));
    expect(again).toEqual({ ok: false, error: "COUPON_FIRST_ORDER_ONLY" });
    expect(await store.validateCoupon("welcome10", 500, "9123456780")).toEqual({ ok: false, reason: "FIRST_ORDER_ONLY" });
    const v = await store.validateCoupon("welcome10", 500, "9000099999");
    expect(v.ok && v.amount).toBe(50);
    expect(await store.validateCoupon("zzz", 500, "9000099999")).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("onlineDue per plan and pending payment rows", async () => {
    const online = ok(await store.placeOrder(input()));
    expect(online.order.payments).toHaveLength(1);
    expect(online.order.payments[0]).toMatchObject({ method: "online", channel: "pending", status: "pending", amount: online.order.bill.total });

    const cash = ok(await store.placeOrder(input({ plan: { kind: "cash" } })));
    expect(cash.onlineDue).toBe(0);
    expect(cash.order.payments).toHaveLength(1);
    expect(cash.order.payments[0]).toMatchObject({ method: "cash", status: "pending" });

    const split = ok(await store.placeOrder(input({ plan: { kind: "split", onlineAmount: 100 } })));
    expect(split.onlineDue).toBe(100);
    expect(split.order.payments.map((p) => [p.method, p.amount])).toEqual([["online", 100], ["cash", split.order.bill.total - 100]]);
  });

  it("redemption writes a negative ledger entry and is refunded on reject", async () => {
    await owner(store);
    const rich = await richCustomer(store);
    const r = ok(await store.placeOrder(input({ phone: rich.phone, pointsToRedeem: 100, lines: [{ itemId: pricey.id, optionIds: [], qty: 2 }] })));
    expect(r.order.bill.pointsRedeemed).toBe(100);
    const detail = (await store.getCustomer(rich.id))!;
    expect(detail.ledger.find((l) => l.orderId === r.order.id)!.points).toBe(-100);
    expect(detail.stats.points).toBe(rich.points - 100);
    await store.updateOrderStatus(r.order.id, "rejected");
    const after = (await store.getCustomer(rich.id))!;
    expect(after.ledger.find((l) => l.reason === "adjust")!.points).toBe(100);
    expect(after.stats.points).toBe(rich.points);
  });

  it("isFirstOrder ignores rejected orders", async () => {
    await owner(store);
    const r = ok(await store.placeOrder(input()));
    expect((await store.lookupLoyalty(PHONE)).isFirstOrder).toBe(false);
    await store.updateOrderStatus(r.order.id, "rejected");
    expect((await store.lookupLoyalty(PHONE)).isFirstOrder).toBe(true);
  });
});

describe("payments", () => {
  it("online success => paid; failure leaves status and marks row failed", async () => {
    const { order, onlineDue } = ok(await store.placeOrder(input()));
    const failed = await store.confirmOnlinePayment(order.id, { channel: "card", amount: onlineDue, success: false, reference: "R0" });
    expect(failed.paymentStatus).toBe("unpaid");
    expect(failed.payments[0].status).toBe("failed");
    const paid = await store.confirmOnlinePayment(order.id, { channel: "upi_qr", amount: onlineDue, success: true, reference: "R1" });
    expect(paid.paymentStatus).toBe("paid");
    expect(paid.payments.find((p) => p.status === "success")).toMatchObject({ channel: "upi_qr", reference: "R1", method: "online" });
  });

  it("split: online => partial, cash remainder => paid; over-due rejected", async () => {
    await owner(store);
    const { order } = ok(await store.placeOrder(input({ plan: { kind: "split", onlineAmount: 100 } })));
    const part = await store.confirmOnlinePayment(order.id, { channel: "upi_id", amount: 100, success: true, reference: "R2" });
    expect(part.paymentStatus).toBe("partial");
    const due = order.bill.total - 100;
    await expect(store.recordCashPayment(order.id, due + 1)).rejects.toThrow("BAD_AMOUNT");
    await expect(store.recordCashPayment(order.id, 0)).rejects.toThrow("BAD_AMOUNT");
    const done = await store.recordCashPayment(order.id, due);
    expect(done.paymentStatus).toBe("paid");
    expect(done.payments.find((p) => p.method === "cash")).toMatchObject({ status: "success", channel: "cash", amount: due });
    await expect(store.recordCashPayment(order.id, 1)).rejects.toThrow("BAD_AMOUNT");
  });

  it("confirmOnlinePayment rejects a mismatched amount and counts a double confirm once", async () => {
    const { order, onlineDue } = ok(await store.placeOrder(input()));
    await expect(store.confirmOnlinePayment(order.id, { channel: "card", amount: 1, success: true, reference: "X" })).rejects.toThrow("BAD_AMOUNT");
    await expect(store.confirmOnlinePayment(order.id, { channel: "card", amount: onlineDue + 5, success: true, reference: "X" })).rejects.toThrow("BAD_AMOUNT");
    expect((await store.getOrder(order.id))!.paymentStatus).toBe("unpaid");
    const first = await store.confirmOnlinePayment(order.id, { channel: "card", amount: onlineDue, success: true, reference: "A" });
    let events = 0;
    store.subscribe("orders", () => events++);
    const msgs = (await store.listMessages({ orderId: order.id })).length;
    const second = await store.confirmOnlinePayment(order.id, { channel: "upi_qr", amount: onlineDue, success: true, reference: "B" });
    expect(second).toEqual(first);
    expect(second.payments).toHaveLength(1);
    expect(second.payments[0].reference).toBe("A");
    expect(events).toBe(0);
    expect((await store.listMessages({ orderId: order.id })).length).toBe(msgs);
  });

  it("retry after a failed payment uses the server amount and succeeds once", async () => {
    const { order, onlineDue } = ok(await store.placeOrder(input()));
    await store.confirmOnlinePayment(order.id, { channel: "card", amount: onlineDue, success: false, reference: "F1" });
    await store.confirmOnlinePayment(order.id, { channel: "card", amount: onlineDue, success: false, reference: "F2" });
    await expect(store.confirmOnlinePayment(order.id, { channel: "card", amount: 1, success: true, reference: "S" })).rejects.toThrow("BAD_AMOUNT");
    const done = await store.confirmOnlinePayment(order.id, { channel: "upi_id", amount: onlineDue, success: true, reference: "S" });
    expect(done.paymentStatus).toBe("paid");
    expect(done.payments.filter((p) => p.status === "success")).toHaveLength(1);
    expect(done.payments.find((p) => p.status === "success")!.amount).toBe(onlineDue);
  });

  it("closed orders refuse payments", async () => {
    await owner(store);
    const { order, onlineDue } = ok(await store.placeOrder(input({ plan: { kind: "split", onlineAmount: 100 } })));
    await store.updateOrderStatus(order.id, "rejected");
    await expect(store.confirmOnlinePayment(order.id, { channel: "card", amount: 100, success: true, reference: "Z" })).rejects.toThrow("ORDER_CLOSED");
    await expect(store.recordCashPayment(order.id, 10)).rejects.toThrow("ORDER_CLOSED");
    expect(onlineDue).toBe(100);
  });

  it("cash cannot cover the still-pending online part of a split", async () => {
    await owner(store);
    const { order } = ok(await store.placeOrder(input({ plan: { kind: "split", onlineAmount: 100 } })));
    const cashDue = order.bill.total - 100;
    await expect(store.recordCashPayment(order.id, order.bill.total)).rejects.toThrow("BAD_AMOUNT");
    await expect(store.recordCashPayment(order.id, cashDue + 1)).rejects.toThrow("BAD_AMOUNT");
    const o = await store.recordCashPayment(order.id, cashDue);
    expect(o.paymentStatus).toBe("partial");
  });

  it("recordCashPayment requires a staff session", async () => {
    const { order } = ok(await store.placeOrder(input({ plan: { kind: "cash" } })));
    await expect(store.recordCashPayment(order.id, 10)).rejects.toThrow("UNAUTHENTICATED");
  });
});

describe("updateOrderStatus", () => {
  it("requires staff", async () => {
    const { order } = ok(await store.placeOrder(input()));
    await expect(store.updateOrderStatus(order.id, "accepted")).rejects.toThrow("UNAUTHENTICATED");
  });

  it("follows allowed transitions and rejects the rest", async () => {
    await store.staffSignIn("kitchen@gluttonsgarage.demo", "garage123");
    const { order } = ok(await store.placeOrder(input()));
    await expect(store.updateOrderStatus(order.id, "ready")).rejects.toThrow("BAD_TRANSITION");
    await expect(store.updateOrderStatus(order.id, "completed")).rejects.toThrow("BAD_TRANSITION");
    await store.updateOrderStatus(order.id, "accepted");
    await expect(store.updateOrderStatus(order.id, "rejected")).rejects.toThrow("BAD_TRANSITION");
    await store.updateOrderStatus(order.id, "preparing");
    await store.updateOrderStatus(order.id, "ready");
    const done = await store.updateOrderStatus(order.id, "completed");
    expect(done.status).toBe("completed");
    await expect(store.updateOrderStatus(order.id, "cancelled")).rejects.toThrow("BAD_TRANSITION");
  });

  it("completed adds an earn ledger entry and a customer message", async () => {
    await owner(store);
    const { order } = ok(await store.placeOrder(input()));
    for (const s of ["accepted", "preparing", "ready"] as const) await store.updateOrderStatus(order.id, s);
    const before = (await store.listMessages({ orderId: order.id })).length;
    await store.updateOrderStatus(order.id, "completed");
    const c = (await store.listCustomers()).find((x) => x.phone === PHONE)!;
    const detail = (await store.getCustomer(c.id))!;
    expect(detail.ledger.find((l) => l.reason === "earn")).toMatchObject({ points: pointsEarned(order.bill.total), orderId: order.id });
    const msgs = await store.listMessages({ orderId: order.id });
    expect(msgs.length).toBeGreaterThan(before);
    expect(msgs.some((m) => m.direction === "to_customer" && m.body.includes(order.code))).toBe(true);
  });

  it("cancel after accept refunds redeemed points", async () => {
    await owner(store);
    const rich = await richCustomer(store);
    const { order } = ok(await store.placeOrder(input({ phone: rich.phone, pointsToRedeem: 100, lines: [{ itemId: pricey.id, optionIds: [], qty: 2 }] })));
    await store.updateOrderStatus(order.id, "accepted");
    await store.updateOrderStatus(order.id, "cancelled");
    expect((await store.lookupLoyalty(rich.phone)).points).toBe(rich.points);
  });
});

describe("staff auth and roles", () => {
  it("signs in, reports session, signs out; bad creds fail", async () => {
    expect(await store.staffSession()).toBeNull();
    expect(await store.staffSignIn("owner@gluttonsgarage.demo", "wrong")).toEqual({ ok: false });
    expect(await store.staffSignIn("OWNER@gluttonsgarage.demo", "garage123")).toEqual({ ok: true, role: "owner" });
    expect(await store.staffSession()).toEqual({ role: "owner", name: "Owner" });
    await store.staffSignOut();
    expect(await store.staffSession()).toBeNull();
  });

  it("kitchen is FORBIDDEN from owner-only methods", async () => {
    await store.staffSignIn("kitchen@gluttonsgarage.demo", "garage123");
    expect(await store.staffSession()).toEqual({ role: "kitchen", name: "Kitchen" });
    await expect(store.updateSettings({ tables: 5 })).rejects.toThrow("FORBIDDEN");
    await expect(store.upsertCoupon((await store.listCoupons())[0])).rejects.toThrow("FORBIDDEN");
    await expect(store.sendCampaign({ name: "n", segment: "all_opted_in", body: "b" })).rejects.toThrow("FORBIDDEN");
    await expect(store.resetDemo()).rejects.toThrow("FORBIDDEN");
  });

  it("anonymous calling owner-only throws UNAUTHENTICATED", async () => {
    await expect(store.updateSettings({ tables: 5 })).rejects.toThrow("UNAUTHENTICATED");
  });

  it("menu and notes writes are staff-only; upsertItem is owner-only", async () => {
    const item = (await store.getMenu()).items[0];
    const cust = (await store.listCustomers())[0];
    await expect(store.setItemAvailability(item.id, false)).rejects.toThrow("UNAUTHENTICATED");
    await expect(store.upsertItem(item)).rejects.toThrow("UNAUTHENTICATED");
    await expect(store.updateCustomerNotes(cust.id, "x")).rejects.toThrow("UNAUTHENTICATED");
    await store.staffSignIn("kitchen@gluttonsgarage.demo", "garage123");
    await store.setItemAvailability(item.id, false);
    await store.updateCustomerNotes(cust.id, "kitchen note");
    await expect(store.upsertItem(item)).rejects.toThrow("FORBIDDEN");
    expect((await store.getMenu()).items[0].available).toBe(false);
  });
});

describe("owner features", () => {
  it("updateSettings merges; upsertCoupon replaces case-insensitively", async () => {
    await owner(store);
    await store.updateSettings({ tables: 4 });
    expect((await store.getSettings()).tables).toBe(4);
    expect((await store.getSettings()).gstPercent).toBe(5);
    const c = (await store.listCoupons()).find((x) => x.code === "WELCOME10")!;
    await store.upsertCoupon({ ...c, code: "welcome10", value: 15 });
    const all = await store.listCoupons();
    expect(all.filter((x) => x.code.toUpperCase() === "WELCOME10")).toHaveLength(1);
    expect(all.find((x) => x.code === "WELCOME10")!.value).toBe(15);
  });

  it("sendCampaign messages opted-in recipients with first name", async () => {
    await owner(store);
    const camp = await store.sendCampaign({ name: "Hi", segment: "all_opted_in", body: "Hello {name}, 10% off" });
    const optedIn = (await store.listCustomers()).filter((c) => c.marketingOptIn);
    expect(camp.sentCount).toBe(optedIn.length);
    expect((await store.listCampaigns())[0].id).toBe(camp.id);
    const msgs = (await store.listMessages({ limit: 1000 })).filter((m) => m.campaignId === camp.id);
    expect(msgs).toHaveLength(optedIn.length);
    expect(msgs.every((m) => !m.body.includes("{name}"))).toBe(true);
    const c = optedIn[0];
    expect(msgs.find((m) => m.to === c.phone)!.body).toBe(`Hello ${c.name.split(" ")[0]}, 10% off`);
  });

  it("customer stats: favourites, avgBill, tags, notes", async () => {
    const c = (await store.listCustomers())[0];
    expect(c.orders).toBeGreaterThan(0);
    expect(c.favourites.length).toBeLessThanOrEqual(3);
    expect(c.avgBill).toBe(Math.round(c.totalSpend / c.orders));
    await owner(store);
    await store.updateCustomerNotes(c.id, "likes window seat");
    expect((await store.getCustomer(c.id))!.stats.notes).toBe("likes window seat");
    const r = ok(await store.placeOrder(input({ phone: "9555500001", name: "Fresh Face" })));
    expect((await store.listCustomers()).find((x) => x.id === r.order.customerId)!.tags).toEqual(["new"]);
  });

  it("menu: availability toggle blocks ordering; resetDemo restores", async () => {
    await owner(store);
    await store.setItemAvailability(cheap.id, false);
    expect((await store.getMenu()).items.find((i) => i.id === cheap.id)!.available).toBe(false);
    expect(await store.placeOrder(input())).toEqual({ ok: false, error: "ITEM_UNAVAILABLE" });
    await store.resetDemo();
    expect((await store.getMenu()).items.find((i) => i.id === cheap.id)!.available).toBe(true);
    expect(await store.staffSession()).not.toBeNull();
  });

  it("listOrders filters by date range and status, newest first", async () => {
    const all = await store.listOrders({});
    expect(all.length).toBeGreaterThan(100);
    for (let i = 1; i < all.length; i++) expect(all[i - 1].createdAt >= all[i].createdAt).toBe(true);
    const rejected = await store.listOrders({ statuses: ["rejected"] });
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected.every((o) => o.status === "rejected")).toBe(true);
    const from = all[10].createdAt;
    expect((await store.listOrders({ from })).every((o) => o.createdAt >= from)).toBe(true);
  });
});

describe("persistence and realtime", () => {
  it("subscribe fires for local writes and unsubscribes", async () => {
    let n = 0;
    const off = store.subscribe("orders", () => n++);
    ok(await store.placeOrder(input()));
    expect(n).toBeGreaterThan(0);
    const seen = n;
    off();
    ok(await store.placeOrder(input()));
    expect(n).toBe(seen);
  });

  it("two instances share storage; B sees A's order and gets notified via channel", async () => {
    const storage = memoryStorage();
    const [ca, cb] = channelPair();
    const a = make(storage, ca);
    const b = make(storage, cb);
    let bOrders = 0;
    let bMsgs = 0;
    b.subscribe("orders", () => bOrders++);
    b.subscribe("messages", () => bMsgs++);
    const r = ok(await a.placeOrder(input()));
    expect(await b.getOrder(r.order.id)).toEqual(r.order);
    expect(bOrders).toBe(1);
    expect(bMsgs).toBe(1);
    // B continues numbering from A's write
    const r2 = ok(await b.placeOrder(input()));
    expect(Number(r2.order.code.slice(3))).toBe(Number(r.order.code.slice(3)) + 1);
  });

  it("works without a channel and persists under gg-demo-v1", async () => {
    const storage = memoryStorage();
    const a = make(storage, null);
    const r = ok(await a.placeOrder(input()));
    const b = make(storage, null);
    expect(await b.getOrder(r.order.id)).not.toBeNull();
    expect(storage.getItem("gg-demo-v1")).not.toBeNull();
  });
});
