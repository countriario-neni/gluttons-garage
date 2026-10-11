// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import fixtures from "../parity/fixtures.json";
import { priceOrder } from "@/domain/pricing";
import type { Coupon } from "@/domain/types";
import type { PlaceOrderInput, PlaceOrderResult, Settings } from "@/store/DataStore";
import { LocalStore } from "@/store/local/LocalStore";
import { call, createDb, rows } from "./harness";

type Case = { name: string; expect: string; setup?: Partial<Settings>; input: Partial<PlaceOrderInput> & { phone?: string } };
const cases = fixtures.cases as unknown as Case[];

function memoryKV() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

let db: PGlite;
let local: LocalStore;
let anchor: Date;
let rich: string;
let phoneSeq = 9300000000;

beforeAll(async () => {
  db = await createDb();
  anchor = new Date((await rows<{ anchor: string }>(db, "admin", "select anchor from seed_meta"))[0].anchor);
  // Reseed at the anchor itself (no shift, nothing skipped) so the SQL data is exactly generateSeed(anchor),
  // like LocalStore's below: balances, coupons and first-order flags then match whatever the time of day.
  await rows(db, "admin", "select public._reseed($1::timestamptz)", [anchor.toISOString()]);
  local = new LocalStore({ storage: memoryKV(), channel: null, now: () => anchor });
  await local.staffSignIn("owner@gluttonsgarage.demo", "garage123");
  for (const c of fixtures.coupons as Coupon[]) {
    await local.upsertCoupon(c);
    await call(db, "owner", "upsert_coupon", [c]);
  }
  rich = (await rows<{ phone: string }>(db, "admin", "select phone from customer_stats where points >= 400 order by phone limit 1"))[0].phone;
}, 120_000);

describe("place_order parity with LocalStore / priceOrder", () => {
  it("has enough fixtures", () => {
    expect(cases.filter((c) => c.expect === "ok").length).toBeGreaterThanOrEqual(12);
  });

  it.each(cases.map((c) => [c.name, c] as const))("%s", async (_name, c) => {
    const phone = c.input.phone === "@rich" ? rich : (c.input.phone ?? String(++phoneSeq));
    const input: PlaceOrderInput = {
      idempotencyKey: "parity-" + c.name,
      name: "Parity Guest",
      marketingOptIn: false,
      mode: "dine_in",
      table: 4,
      pickupTime: null,
      lines: [{ itemId: "the-beginning-chicken-cutlets", optionIds: [], qty: 2 }],
      couponCode: null,
      pointsToRedeem: 0,
      plan: { kind: "online" },
      ...c.input,
      phone,
    };
    if (c.setup) {
      await local.updateSettings(c.setup);
      await call(db, "owner", "update_settings", [c.setup]);
    }
    const loyalty = await local.lookupLoyalty(phone);
    expect(await call(db, "anon", "lookup_loyalty", [phone])).toMatchObject({ points: loyalty.points, isFirstOrder: loyalty.isFirstOrder });

    const expected = await local.placeOrder(input);
    const actual = await call<PlaceOrderResult>(db, "anon", "place_order", [input]);
    if (c.setup) {
      const restore = { acceptingOrders: true };
      await local.updateSettings(restore);
      await call(db, "owner", "update_settings", [restore]);
    }

    expect(expected.ok ? "ok" : expected.error, "LocalStore outcome").toBe(c.expect);
    if (!expected.ok || !actual.ok) {
      expect(actual).toEqual(expected);
      return;
    }
    // Bills match LocalStore and a direct priceOrder call; payments plans match too.
    expect(actual.order.bill).toEqual(expected.order.bill);
    const coupon = input.couponCode ? ((await local.listCoupons()).find((x) => x.code === input.couponCode!.trim().toUpperCase()) ?? null) : null;
    if (coupon) coupon.usedCount--; // placeOrder already counted this use
    const direct = priceOrder({
      lines: input.lines,
      menu: (await local.getMenu()).items,
      coupon,
      isFirstOrder: loyalty.isFirstOrder,
      pointsToRedeem: input.pointsToRedeem,
      pointsBalance: loyalty.points,
      now: anchor,
    });
    expect(direct.ok && direct.bill).toEqual(actual.order.bill);
    expect(actual.onlineDue).toBe(expected.onlineDue);
    expect(actual.order.couponCode).toBe(expected.order.couponCode);
    expect(actual.order.payments.map((p) => [p.method, p.amount, p.status])).toEqual(expected.order.payments.map((p) => [p.method, p.amount, p.status]));
  });
});

describe("float rounding matches JavaScript Math.round", () => {
  it("GST on every taxable amount 0..20000", async () => {
    const [{ r }] = await rows<{ r: number[] }>(db, "admin", "select array_agg(public._js_round(t::float8 * 0.05::float8) order by t) r from generate_series(0, 20000) t");
    expect(r).toEqual(Array.from({ length: 20001 }, (_, t) => Math.round(t * 0.05)));
  });

  it("percent coupons", async () => {
    const values = [5, 7, 10, 12, 15, 18, 20, 25, 33, 50];
    const [{ r }] = await rows<{ r: number[] }>(
      db,
      "admin",
      "select array_agg(public._js_round((s * v)::float8 / 100) order by v, s) r from unnest($1::int[]) v, generate_series(0, 3000) s",
      [values],
    );
    expect(r).toEqual(values.flatMap((v) => Array.from({ length: 3001 }, (_, s) => Math.round((s * v) / 100))));
  });
});
