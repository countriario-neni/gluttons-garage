// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { call, createDb, rows } from "./harness";

let db: PGlite;
let tables: string[];
beforeAll(async () => {
  db = await createDb();
  // The seed has no messages; one order gives message_log rows to (not) see.
  const r = await call<{ ok: boolean }>(db, "anon", "place_order", [
    { idempotencyKey: "rls", name: "R", phone: "9811111111", marketingOptIn: false, mode: "dine_in", table: 1, pickupTime: null,
      lines: [{ itemId: "breads-bread-toast", optionIds: [], qty: 1 }], couponCode: null, pointsToRedeem: 0, plan: { kind: "online" } },
  ]);
  expect(r.ok).toBe(true);
  tables = (await rows<{ t: string }>(db, "admin", "select tablename t from pg_tables where schemaname = 'public' order by 1")).map((r) => r.t);
}, 120_000);

const PRIVATE = ["customers", "orders", "order_items", "payments", "loyalty_ledger", "message_log", "campaigns", "staff", "coupons", "settings"];
const PUBLIC_READ = ["menu_categories", "menu_items", "item_options", "tables", "public_settings"];
const ANON_FUNCTIONS = ["confirm_online_payment", "get_order_public", "lookup_loyalty", "place_order", "validate_coupon"];
const OWNER_CALLS: [string, unknown[]][] = [
  ["update_settings", [{ tables: 5 }]],
  ["upsert_coupon", [{ code: "X1", type: "flat", value: 1, minOrder: 0, maxDiscount: null, expiresAt: null, usageLimit: null, usedCount: 0, firstOrderOnly: false, active: true }]],
  ["send_campaign", ["n", "all_opted_in", "b"]],
  ["upsert_item", [{ id: "x", categoryId: "breads", name: "x", description: null, price: 1, veg: true, egg: null, image: null, tags: [], options: [], available: true }]],
  ["reset_demo", []],
];

describe("anon", () => {
  it("cannot read private tables", async () => {
    for (const t of PRIVATE) await expect(rows(db, "anon", `select * from ${t} limit 1`), t).rejects.toThrow(/permission denied/);
  });

  it("cannot read seed tables", async () => {
    for (const t of tables.filter((x) => x.startsWith("seed_"))) await expect(rows(db, "anon", `select * from ${t} limit 1`), t).rejects.toThrow(/permission denied/);
  });

  it("cannot insert, update or delete any table directly", async () => {
    expect(tables.length).toBeGreaterThan(20);
    for (const t of tables) {
      const [col] = await rows<{ c: string }>(db, "admin", "select column_name c from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position limit 1", [t]);
      await expect(rows(db, "anon", `insert into ${t} default values`), `insert ${t}`).rejects.toThrow(/permission denied|violates row-level security/);
      await expect(rows(db, "anon", `update ${t} set ${col.c} = ${col.c}`), `update ${t}`).rejects.toThrow(/permission denied/);
      await expect(rows(db, "anon", `delete from ${t}`), `delete ${t}`).rejects.toThrow(/permission denied/);
    }
  });

  it("can read the menu, tables and public settings", async () => {
    for (const t of PUBLIC_READ) expect((await rows(db, "anon", `select * from ${t}`)).length, t).toBeGreaterThan(0);
  });

  it("can execute exactly the public functions", async () => {
    const fns = await rows<{ name: string; anon: boolean; auth: boolean; definer: boolean; cfg: string[] | null }>(
      db,
      "admin",
      `select p.proname as name, has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as auth, p.prosecdef as definer, p.proconfig as cfg
         from pg_proc p where p.pronamespace = 'public'::regnamespace`,
    );
    expect(fns.filter((f) => f.anon).map((f) => f.name).sort()).toEqual(ANON_FUNCTIONS);
    // Internal helpers (underscore-prefixed) are callable by nobody from the API.
    expect(fns.filter((f) => f.name.startsWith("_") && (f.anon || f.auth)).map((f) => f.name)).toEqual([]);
    // Every security-definer function pins its search_path.
    expect(fns.filter((f) => f.definer && !(f.cfg ?? []).some((c) => c.startsWith("search_path=public, pg_temp"))).map((f) => f.name)).toEqual([]);
  });

  it("is refused staff and owner functions", async () => {
    await expect(call(db, "anon", "update_order_status", ["00000000-0000-4000-8000-000000000000", "accepted"])).rejects.toThrow(/permission denied/);
    await expect(call(db, "anon", "record_cash_payment", ["00000000-0000-4000-8000-000000000000", 1])).rejects.toThrow(/permission denied/);
    for (const [fn, args] of OWNER_CALLS) await expect(call(db, "anon", fn, args), fn).rejects.toThrow(/permission denied/);
  });
});

describe("authenticated", () => {
  it("kitchen is FORBIDDEN from owner-only functions", async () => {
    for (const [fn, args] of OWNER_CALLS) await expect(call(db, "kitchen", fn, args), fn).rejects.toThrow("FORBIDDEN");
  });

  it("staff can read orders and private tables", async () => {
    for (const t of PRIVATE) expect((await rows(db, "kitchen", `select * from ${t} limit 1`)).length, t).toBeGreaterThan(t === "campaigns" ? -1 : 0);
  });

  it("staff cannot write tables directly either", async () => {
    await expect(rows(db, "owner", "update orders set total = 0")).rejects.toThrow(/permission denied/);
    await expect(rows(db, "owner", "delete from customers")).rejects.toThrow(/permission denied/);
  });

  it("a signed-in non-staff user sees nothing and is UNAUTHENTICATED", async () => {
    for (const t of PRIVATE.filter((t) => t !== "settings")) expect(await rows(db, "stranger", `select * from ${t} limit 1`), t).toEqual([]);
    await expect(call(db, "stranger", "update_order_status", ["00000000-0000-4000-8000-000000000000", "accepted"])).rejects.toThrow("UNAUTHENTICATED");
    await expect(call(db, "stranger", "reset_demo")).rejects.toThrow("UNAUTHENTICATED");
    await expect(call(db, "stranger", "list_orders", [null, null, null])).rejects.toThrow("UNAUTHENTICATED");
  });
});
