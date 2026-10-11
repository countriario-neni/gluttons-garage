// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { items } from "@/data/menu";
import { generateSeed } from "@/data/seed";
import { pointsEarned } from "@/domain/loyalty";
import type { Campaign, CustomerStats, Order, PlaceOrderInput, PlaceOrderResult } from "@/store/DataStore";
import { call, createDb, rows } from "./harness";

const cheap = items.find((i) => i.price >= 100 && i.price <= 150)!;
const pricey = items.find((i) => i.price >= 250 && i.price <= 320)!;
let n = 0;
let phoneSeq = 9100000000;
const freshPhone = () => String(++phoneSeq);
const input = (over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  idempotencyKey: "k-" + ++n,
  name: "Test Guest",
  phone: freshPhone(),
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

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
}, 120_000);

const place = (i: PlaceOrderInput) => call<PlaceOrderResult>(db, "anon", "place_order", [i]);
const ok = async (i: PlaceOrderInput) => {
  const r = await place(i);
  if (!r.ok) throw new Error("expected ok, got " + r.error);
  return r;
};
const confirm = (id: string, amount: number, success = true, channel = "card", reference = "R") =>
  call<Order>(db, "anon", "confirm_online_payment", [id, channel, amount, success, reference]);
const status = (id: string, s: string, who: "owner" | "kitchen" = "owner") => call<Order>(db, who, "update_order_status", [id, s]);
const cash = (id: string, amount: number) => call<Order>(db, "owner", "record_cash_payment", [id, amount]);
const getOrder = (id: string) => call<Order>(db, "owner", "get_order", [id]);
const messages = (orderId: string) => rows<{ direction: string; body: string; to_phone: string }>(db, "owner", "select * from message_log where order_id = $1", [orderId]);
const stats = async (phone: string) => (await rows<{ id: string; points: number }>(db, "owner", "select * from customer_stats where phone = $1", [phone]))[0];
const richPhone = async () => (await rows<{ phone: string; points: number }>(db, "admin", "select phone, points from customer_stats where points >= 300 order by phone limit 1"))[0];

describe("seed", () => {
  const TERMINAL = ["completed", "rejected", "cancelled"];
  const count = async (t: string) => (await rows<{ c: number }>(db, "admin", `select count(*)::int c from ${t}`))[0].c;
  const anchorOf = async () => new Date((await rows<{ anchor: string }>(db, "admin", "select anchor from seed_meta"))[0].anchor);
  const istTime = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(11, 19);
  const reseed = (at: Date | null) => rows(db, "admin", "select public._reseed($1::timestamptz)", [at?.toISOString() ?? null]);
  /** Ledger matches the kept orders: earn floor(total/10) per completed order, minus redemptions. */
  const ledgerConsistent = async () =>
    rows(
      db,
      "admin",
      `select c.id from customers c
        where coalesce((select sum(points) from loyalty_ledger l where l.customer_id = c.id), 0)
           <> coalesce((select sum(case when o.status = 'completed' then floor(o.total / 10.0)::int else 0 end) - sum(o.points_redeemed)
                          from orders o where o.customer_id = c.id), 0)`,
    );

  it("reseeded at the anchor, the snapshot equals generateSeed", async () => {
    const anchor = await anchorOf();
    const s = generateSeed(anchor);
    await reseed(anchor);
    expect(await count("customers")).toBe(s.customers.length);
    expect(await count("orders")).toBe(s.orders.length);
    expect(await count("loyalty_ledger")).toBe(s.ledger.length);
    expect(await count("payments")).toBe(s.orders.reduce((a, o) => a + o.payments.length, 0));
    expect(await count("menu_items")).toBe(s.items.length);
    expect(await count("item_options")).toBe(s.items.reduce((a, i) => a + i.options.length, 0));
    const [{ t }] = await rows<{ t: number }>(db, "admin", "select coalesce(sum(total),0)::int t from orders");
    expect(t).toBe(s.orders.reduce((a, o) => a + o.bill.total, 0));
    expect(await ledgerConsistent()).toEqual([]);
  });

  it("history shifts by whole days (time of day kept), skips the future, keeps the ledger consistent", async () => {
    const anchor = await anchorOf();
    const s = generateSeed(anchor);
    // 3 days after the anchor at 08:05 IST: most of the anchor day's history (08:00-15:00 IST) would be in the future.
    const istDay = new Date(anchor.getTime() + 330 * 60000).toISOString().slice(0, 10);
    const at = new Date(new Date(`${istDay}T08:05:00+05:30`).getTime() + 3 * 86400000);
    await reseed(at);
    const orders = await rows<{ id: string; code: string; status: string; created_at: string; pickup_time: string | null; mode: string }>(
      db,
      "admin",
      "select id, short_code code, status, to_json(created_at)#>>'{}' created_at, pickup_time, mode from orders",
    );
    expect(orders.length).toBeLessThan(s.orders.length);
    expect(orders.every((o) => new Date(o.created_at) <= at)).toBe(true);
    // skipped orders took their children with them
    const kept = new Set(orders.map((o) => o.code));
    const skipped = s.orders.filter((o) => !kept.has(o.code));
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped.every((o) => TERMINAL.includes(o.status))).toBe(true);
    expect(await count("payments")).toBe(s.orders.filter((o) => kept.has(o.code)).reduce((a, o) => a + o.payments.length, 0));
    expect(await count("order_items")).toBe(s.orders.filter((o) => kept.has(o.code)).reduce((a, o) => a + o.bill.lines.length, 0));
    expect(await ledgerConsistent()).toEqual([]);
    // a historical order keeps its time of day
    const first = s.orders[0];
    expect(istTime(orders.find((o) => o.code === first.code)!.created_at)).toBe(istTime(first.createdAt));
    // the 3 in-flight orders are re-stamped relative to now, pickup ~30 min ahead as in generateSeed
    const live = orders.filter((o) => !TERMINAL.includes(o.status));
    expect(live).toHaveLength(3);
    for (const o of live) expect((at.getTime() - new Date(o.created_at).getTime()) / 60000).toBeLessThanOrEqual(30);
    const takeaway = live.find((o) => o.mode === "takeaway")!;
    expect(takeaway.pickup_time).toBe(istTime(new Date(at.getTime() + 30 * 60000).toISOString()).slice(0, 5));
    await reseed(null);
  });

  it("reset at the real now: nothing in the future, 3 live orders minutes old", async () => {
    const future = await rows(db, "admin", "select 1 from orders where created_at > now()");
    expect(future).toEqual([]);
    const live = await rows<{ age: number }>(db, "admin", "select extract(epoch from now() - created_at)::int age from orders where status not in ('completed','rejected','cancelled')");
    expect(live).toHaveLength(3);
    expect(live.every((o) => o.age >= 0 && o.age < 30 * 60)).toBe(true);
    expect(await ledgerConsistent()).toEqual([]);
  });
});

describe("place_order", () => {
  it("stores order, upserts customer by phone, writes 2 messages, codes increment", async () => {
    const phone = freshPhone();
    const r = await ok(input({ phone: "+91 " + phone.slice(0, 5) + " " + phone.slice(5) }));
    expect(r.order.status).toBe("placed");
    expect(r.order.paymentStatus).toBe("unpaid");
    expect(r.order.phone).toBe(phone);
    expect(r.onlineDue).toBe(r.order.bill.total);
    expect(await getOrder(r.order.id)).toEqual(r.order);
    const msgs = await messages(r.order.id);
    expect(msgs.map((m) => m.direction).sort()).toEqual(["to_cafe", "to_customer"]);
    expect(msgs.find((m) => m.direction === "to_customer")!.to_phone).toBe(phone);
    expect(msgs.find((m) => m.direction === "to_customer")!.body).toContain(r.order.code);
    const r2 = await ok(input({ phone }));
    expect(r2.order.customerId).toBe(r.order.customerId);
    expect(Number(r2.order.code.slice(3))).toBe(Number(r.order.code.slice(3)) + 1);
    expect((await stats(phone)).id).toBe(r.order.customerId);
  });

  it("is idempotent on idempotencyKey", async () => {
    const i = input();
    const a = await ok(i);
    const b = await ok(i);
    expect(b.order.id).toBe(a.order.id);
    expect(b.onlineDue).toBe(a.onlineDue);
    expect(await messages(a.order.id)).toHaveLength(2);
  });

  it("recomputes the bill from the menu (ignores tampered client prices)", async () => {
    const tampered = { itemId: cheap.id, optionIds: [], qty: 1, price: 1, unitPrice: 1, lineTotal: 1 } as never;
    const r = await ok(input({ lines: [tampered] }));
    expect(r.order.bill.subtotal).toBe(cheap.price);
  });

  it("onlineDue per plan and pending payment rows", async () => {
    const online = await ok(input());
    expect(online.order.payments).toHaveLength(1);
    expect(online.order.payments[0]).toMatchObject({ method: "online", channel: "pending", status: "pending", amount: online.order.bill.total });
    const c = await ok(input({ plan: { kind: "cash" } }));
    expect(c.onlineDue).toBe(0);
    expect(c.order.payments.map((p) => [p.method, p.status])).toEqual([["cash", "pending"]]);
    const split = await ok(input({ plan: { kind: "split", onlineAmount: 100 } }));
    expect(split.onlineDue).toBe(100);
    expect(split.order.payments.map((p) => [p.method, p.amount])).toEqual([["online", 100], ["cash", split.order.bill.total - 100]]);
  });

  it("coupons are case-insensitive, usedCount increments, first-order-only enforced", async () => {
    const used = async () => (await rows<{ used_count: number }>(db, "admin", "select used_count from coupons where code = 'WELCOME10'"))[0].used_count;
    const before = await used();
    const phone = freshPhone();
    const r = await ok(input({ couponCode: " welcome10 ", phone }));
    expect(r.order.couponCode).toBe("WELCOME10");
    expect(r.order.bill.couponDiscount).toBeGreaterThan(0);
    expect(await used()).toBe(before + 1);
    expect(await place(input({ couponCode: "WELCOME10", phone }))).toEqual({ ok: false, error: "COUPON_FIRST_ORDER_ONLY" });
    expect(await call(db, "anon", "validate_coupon", ["welcome10", 500, phone])).toEqual({ ok: false, reason: "FIRST_ORDER_ONLY" });
    const v = await call<{ ok: boolean; amount: number; coupon: { code: string } }>(db, "anon", "validate_coupon", ["welcome10", 500, freshPhone()]);
    expect(v).toMatchObject({ ok: true, amount: 50, coupon: { code: "WELCOME10", type: "percent", maxDiscount: 100 } });
    expect(await call(db, "anon", "validate_coupon", ["zzz", 500, freshPhone()])).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("redemption writes a negative ledger entry, refunded on reject; isFirstOrder ignores rejected", async () => {
    const rich = await richPhone();
    const r = await ok(input({ phone: rich.phone, pointsToRedeem: 100, lines: [{ itemId: pricey.id, optionIds: [], qty: 2 }] }));
    expect(r.order.bill.pointsRedeemed).toBe(100);
    expect((await stats(rich.phone)).points).toBe(rich.points - 100);
    await status(r.order.id, "rejected");
    expect((await stats(rich.phone)).points).toBe(rich.points);
    const adj = await rows<{ points: number }>(db, "admin", "select points from loyalty_ledger where order_id = $1 and reason = 'adjust'", [r.order.id]);
    expect(adj).toEqual([{ points: 100 }]);

    const phone = freshPhone();
    const first = await ok(input({ phone }));
    expect(await call(db, "anon", "lookup_loyalty", [phone])).toMatchObject({ isFirstOrder: false, points: 0 });
    await status(first.order.id, "rejected");
    expect(await call(db, "anon", "lookup_loyalty", [phone])).toMatchObject({ isFirstOrder: true });
  });

  it("rejects bad input without writing anything", async () => {
    const before = await rows<{ c: number }>(db, "admin", "select count(*)::int c from orders");
    for (const [code, over] of [
      ["BAD_PHONE", { phone: "12345" }],
      ["BAD_NAME", { name: "   " }],
      ["BAD_TABLE", { table: 2.5 }],
      ["BAD_POINTS", { pointsToRedeem: null }],
      ["EMPTY_CART", { lines: [] }],
      ["BAD_QTY", { lines: [{ itemId: cheap.id, optionIds: [], qty: "2" }] }],
      ["BAD_OPTION", { lines: [{ itemId: cheap.id, optionIds: "x", qty: 1 }] }],
      ["BAD_NOTE", { lines: [{ itemId: cheap.id, optionIds: [], qty: 1, note: "n".repeat(201) }] }],
      ["TOO_MANY_LINES", { lines: Array.from({ length: 51 }, () => ({ itemId: cheap.id, optionIds: [], qty: 1 })) }],
      ["BAD_MODE", { mode: "delivery" }],
      ["BAD_PLAN", { plan: { kind: "crypto" } }],
      ["BAD_REQUEST", { idempotencyKey: "" }],
    ] as const) {
      expect(await place(input(over as never)), code).toEqual({ ok: false, error: code });
    }
    expect(await rows(db, "admin", "select count(*)::int c from orders")).toEqual(before);
  });
});

describe("payments", () => {
  it("online failure marks the row failed; success => paid; payment_received message only on success", async () => {
    const { order, onlineDue } = await ok(input());
    const failed = await confirm(order.id, onlineDue, false);
    expect(failed.paymentStatus).toBe("unpaid");
    expect(failed.payments[0].status).toBe("failed");
    const count = async () => (await messages(order.id)).filter((m) => m.body.includes("received your payment")).length;
    expect(await count()).toBe(0);
    const paid = await confirm(order.id, onlineDue, true, "upi_qr", "R1");
    expect(paid.paymentStatus).toBe("paid");
    expect(paid.payments.find((p) => p.status === "success")).toMatchObject({ channel: "upi_qr", method: "online" });
    expect(await count()).toBe(1);
  });

  it("rejects a mismatched amount; double confirm counts once", async () => {
    const { order, onlineDue } = await ok(input());
    await expect(confirm(order.id, 1)).rejects.toThrow("BAD_AMOUNT");
    await expect(confirm(order.id, onlineDue + 5)).rejects.toThrow("BAD_AMOUNT");
    await confirm(order.id, onlineDue, true, "card", "A");
    await confirm(order.id, onlineDue, true, "upi_qr", "B");
    const o = await getOrder(order.id);
    expect(o.payments).toHaveLength(1);
    expect(o.payments[0].reference).toBe("A");
    expect((await messages(order.id)).filter((m) => m.body.includes("received your payment"))).toHaveLength(1);
  });

  it("retry after failures uses the server amount and succeeds once", async () => {
    const { order, onlineDue } = await ok(input());
    await confirm(order.id, onlineDue, false);
    await confirm(order.id, onlineDue, false);
    await expect(confirm(order.id, 1)).rejects.toThrow("BAD_AMOUNT");
    const done = await confirm(order.id, onlineDue, true, "upi_id", "S");
    expect(done.paymentStatus).toBe("paid");
    const o = await getOrder(order.id);
    expect(o.payments.filter((p) => p.status === "success")).toHaveLength(1);
    expect(o.payments.filter((p) => p.status === "failed")).toHaveLength(2);
  });

  it("split: online => partial, cash remainder => paid; over-due and pending-online cover rejected", async () => {
    const { order } = await ok(input({ plan: { kind: "split", onlineAmount: 100 } }));
    const due = order.bill.total - 100;
    await expect(cash(order.id, order.bill.total)).rejects.toThrow("BAD_AMOUNT");
    const part = await confirm(order.id, 100, true, "upi_id");
    expect(part.paymentStatus).toBe("partial");
    await expect(cash(order.id, due + 1)).rejects.toThrow("BAD_AMOUNT");
    await expect(cash(order.id, 0)).rejects.toThrow("BAD_AMOUNT");
    const done = await cash(order.id, due);
    expect(done.paymentStatus).toBe("paid");
    expect(done.payments.find((p) => p.method === "cash")).toMatchObject({ status: "success", channel: "cash", amount: due });
    await expect(cash(order.id, 1)).rejects.toThrow("BAD_AMOUNT");
    expect((await messages(order.id)).filter((m) => m.body.includes("received your payment"))).toHaveLength(2);
  });

  it("closed orders refuse payments; unknown orders are ORDER_NOT_FOUND", async () => {
    const { order } = await ok(input({ plan: { kind: "split", onlineAmount: 100 } }));
    await status(order.id, "rejected");
    await expect(confirm(order.id, 100)).rejects.toThrow("ORDER_CLOSED");
    await expect(cash(order.id, 10)).rejects.toThrow("ORDER_CLOSED");
    await expect(confirm("00000000-0000-4000-8000-00000000dead", 100)).rejects.toThrow("ORDER_NOT_FOUND");
  });
});

describe("update_order_status", () => {
  it("follows allowed transitions (kitchen allowed), earns points on completed, messages except preparing", async () => {
    const { order } = await ok(input());
    await expect(status(order.id, "ready", "kitchen")).rejects.toThrow("BAD_TRANSITION");
    await expect(status(order.id, "bogus", "kitchen")).rejects.toThrow("BAD_TRANSITION");
    await status(order.id, "accepted", "kitchen");
    await expect(status(order.id, "rejected", "kitchen")).rejects.toThrow("BAD_TRANSITION");
    const m0 = (await messages(order.id)).length;
    await status(order.id, "preparing", "kitchen");
    expect((await messages(order.id)).length).toBe(m0);
    await status(order.id, "ready", "kitchen");
    const done = await status(order.id, "completed", "kitchen");
    expect(done.status).toBe("completed");
    expect((await messages(order.id)).length).toBe(m0 + 2);
    const earn = await rows<{ points: number }>(db, "admin", "select points from loyalty_ledger where order_id = $1 and reason = 'earn'", [order.id]);
    expect(earn).toEqual([{ points: pointsEarned(order.bill.total) }]);
    await expect(status(order.id, "cancelled")).rejects.toThrow("BAD_TRANSITION");
  });

  it("cancel after accept refunds redeemed points", async () => {
    const rich = await richPhone();
    const { order } = await ok(input({ phone: rich.phone, pointsToRedeem: 100, lines: [{ itemId: pricey.id, optionIds: [], qty: 2 }] }));
    await status(order.id, "accepted");
    await status(order.id, "cancelled");
    expect((await call<{ points: number }>(db, "anon", "lookup_loyalty", [rich.phone])).points).toBe(rich.points);
  });
});

describe("public order view", () => {
  it("get_order_public masks phone, first name only, no references, customer messages only", async () => {
    const { order, onlineDue } = await ok(input({ name: "Sravani Reddy" }));
    await confirm(order.id, onlineDue, true, "card", "SECRET-REF");
    const pub = await call<Record<string, unknown>>(db, "anon", "get_order_public", [order.id]);
    const s = JSON.stringify(pub);
    expect(s).not.toContain(order.phone);
    expect(s).not.toContain("SECRET-REF");
    expect(s).not.toContain("Reddy");
    expect(pub).toMatchObject({ id: order.id, code: order.code, customerName: "Sravani", status: "placed", paymentStatus: "paid", bill: order.bill });
    const msgs = pub.messages as { direction: string }[];
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs.every((m) => m.direction === "to_customer")).toBe(true);
    expect(await call(db, "anon", "get_order_public", ["00000000-0000-4000-8000-00000000dead"])).toBeNull();
  });

  it("lookup_loyalty returns first name and points only", async () => {
    const rich = await richPhone();
    const r = await call<Record<string, unknown>>(db, "anon", "lookup_loyalty", [rich.phone]);
    expect(Object.keys(r).sort()).toEqual(["isFirstOrder", "name", "points"]);
    expect(r.points).toBe(rich.points);
    expect(String(r.name)).not.toContain(" ");
    expect(await call(db, "anon", "lookup_loyalty", ["junk"])).toEqual({ points: 0, isFirstOrder: true, name: null });
  });
});

describe("staff and owner functions", () => {
  it("list_orders filters by status and date, newest first", async () => {
    const all = await call<Order[]>(db, "kitchen", "list_orders", [null, null, null]);
    expect(all.length).toBeGreaterThan(100);
    for (let i = 1; i < all.length; i++) expect(all[i - 1].createdAt >= all[i].createdAt).toBe(true);
    const rejected = await call<Order[]>(db, "kitchen", "list_orders", [null, null, ["rejected"]]);
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected.every((o) => o.status === "rejected")).toBe(true);
    const from = all[10].createdAt;
    expect((await call<Order[]>(db, "kitchen", "list_orders", [from, null, null])).every((o) => o.createdAt >= from)).toBe(true);
  });

  it("get_customer returns stats, orders and ledger; notes are staff-writable", async () => {
    const [c] = await rows<CustomerStats & { id: string }>(db, "admin", "select id from customer_stats where points > 0 order by last_order_at desc nulls last limit 1");
    await call(db, "kitchen", "update_customer_notes", [c.id, "likes window seat"]);
    const d = await call<{ stats: CustomerStats; orders: Order[]; ledger: unknown[] }>(db, "kitchen", "get_customer", [c.id]);
    expect(d.stats.notes).toBe("likes window seat");
    expect(d.orders.length).toBe(d.stats.orders + d.orders.filter((o) => o.status === "rejected" || o.status === "cancelled").length);
    expect(d.stats.avgBill).toBe(Math.round(d.stats.totalSpend / d.stats.orders));
    expect(d.ledger.length).toBeGreaterThan(0);
  });

  it("availability toggle blocks ordering; owner settings and coupons; reset_demo restores", async () => {
    await call(db, "kitchen", "set_item_availability", [cheap.id, false]);
    expect(await place(input())).toEqual({ ok: false, error: "ITEM_UNAVAILABLE" });
    await call(db, "owner", "update_settings", [{ tables: 4, acceptingOrders: false }]);
    const [s] = await rows<{ tables: number; gst_percent: number }>(db, "anon", "select * from public_settings");
    expect(s).toMatchObject({ tables: 4, gst_percent: 5 });
    expect(await place(input())).toEqual({ ok: false, error: "NOT_ACCEPTING" });
    await expect(call(db, "owner", "update_settings", [{ tables: "many" }])).rejects.toThrow("BAD_INPUT");
    const loyalty = { earnPerRupees: 10, redeemBlock: 100, redeemValue: 50, maxShare: 0.5 };
    for (const bad of [
      { ...loyalty, earnPerRupees: 0 },
      { ...loyalty, redeemBlock: -100 },
      { ...loyalty, redeemValue: 2.5 },
      { ...loyalty, redeemBlock: "100" },
      { ...loyalty, maxShare: 0 },
      { ...loyalty, maxShare: 1.5 },
      { ...loyalty, maxShare: "0.5" },
      { earnPerRupees: 10, redeemBlock: 100, redeemValue: 50 },
      { ...loyalty, extra: 1 },
      [],
    ]) {
      await expect(call(db, "owner", "update_settings", [{ loyalty: bad }]), JSON.stringify(bad)).rejects.toThrow("BAD_INPUT");
    }
    await call(db, "owner", "update_settings", [{ loyalty: { ...loyalty, maxShare: 1 } }]);
    expect((await rows<{ loyalty: unknown }>(db, "anon", "select loyalty from public_settings"))[0].loyalty).toEqual({ ...loyalty, maxShare: 1 });
    await call(db, "owner", "upsert_coupon", [{ code: "welcome10", type: "percent", value: 15, minOrder: 0, maxDiscount: 100, expiresAt: null, usageLimit: null, usedCount: 0, firstOrderOnly: true, active: true }]);
    expect(await rows(db, "admin", "select code, value from coupons where upper(code) = 'WELCOME10'")).toEqual([{ code: "WELCOME10", value: 15 }]);

    await call(db, "owner", "reset_demo");
    const [after] = await rows<{ is_available: boolean }>(db, "anon", "select is_available from menu_items where id = $1", [cheap.id]);
    expect(after.is_available).toBe(true);
    expect((await rows<{ accepting_orders: boolean }>(db, "anon", "select accepting_orders from public_settings"))[0].accepting_orders).toBe(true);
    expect(await rows(db, "admin", "select value from coupons where code = 'WELCOME10'")).toEqual([{ value: 10 }]);
    expect(await rows(db, "admin", "select 1 from orders where created_at > now()")).toEqual([]);
    expect(await rows(db, "admin", "select 1 from orders where status not in ('completed','rejected','cancelled')")).toHaveLength(3);
    // codes continue from the seed after a reset
    const r = await ok(input());
    const [{ next_code }] = await rows<{ next_code: number }>(db, "admin", "select next_code from seed_meta");
    expect(r.order.code).toBe(`GG-${next_code}`);
  });

  it("upsert_item validates and replaces options", async () => {
    const item = { ...cheap, name: "Renamed", options: [{ id: cheap.id + "--x", group: "Add-ons", label: "X", priceDelta: 5 }] };
    await call(db, "owner", "upsert_item", [item]);
    const opts = await rows(db, "anon", "select id, price_delta from item_options where item_id = $1", [cheap.id]);
    expect(opts).toEqual([{ id: cheap.id + "--x", price_delta: 5 }]);
    await expect(call(db, "owner", "upsert_item", [{ ...item, price: -1 }])).rejects.toThrow("BAD_INPUT");
    await expect(call(db, "owner", "upsert_item", [{ ...item, categoryId: "nope" }])).rejects.toThrow("BAD_INPUT");
    await call(db, "owner", "reset_demo");
  });

  it("send_campaign messages opted-in recipients by first name", async () => {
    const camp = await call<Campaign>(db, "owner", "send_campaign", ["Hi", "all_opted_in", "Hello {name}, 10% off"]);
    const opted = await rows<{ c: number }>(db, "admin", "select count(*)::int c from customers where marketing_opt_in");
    expect(camp.sentCount).toBe(opted[0].c);
    const msgs = await rows<{ body: string; to_phone: string }>(db, "admin", "select body, to_phone from message_log where campaign_id = $1", [camp.id]);
    expect(msgs).toHaveLength(opted[0].c);
    expect(msgs.every((m) => !m.body.includes("{name}"))).toBe(true);
    const [c] = await rows<{ name: string; phone: string }>(db, "admin", "select name, phone from customers where marketing_opt_in order by phone limit 1");
    expect(msgs.find((m) => m.to_phone === c.phone)!.body).toBe(`Hello ${c.name.split(" ")[0]}, 10% off`);
    await expect(call(db, "owner", "send_campaign", ["Hi", "all_opted_in", "x".repeat(1001)])).rejects.toThrow("BAD_INPUT");
    await expect(call(db, "owner", "send_campaign", ["Hi", "everyone", "x"])).rejects.toThrow("BAD_INPUT");
  });
});
