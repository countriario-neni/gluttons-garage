import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseStore } from "@/store/supabase/SupabaseStore";
import { errorCode } from "@/store/supabase/mappers";

// Behaviour is covered against real SQL in tests/sql; this checks the TS <-> RPC mapping only.

const ID = "00000000-0000-4000-8002-000000001001";
type Res = { data?: unknown; error?: { message: string; code?: string } | null };

function fakeClient(opts: { session?: boolean; rpc?: (fn: string, args: unknown) => Res; tables?: Record<string, unknown>; signIn?: Res } = {}) {
  const rpc = vi.fn(async (fn: string, args?: unknown) => ({ data: null, error: null, ...(opts.rpc?.(fn, args) ?? {}) }));
  const query = (table: string) => {
    const result = { data: opts.tables?.[table] ?? null, error: null };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "order", "eq"]) q[m] = vi.fn(() => q);
    q.maybeSingle = q.single = vi.fn(async () => result);
    q.then = (resolve: (v: unknown) => void) => resolve(result);
    return q;
  };
  const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
  const client = {
    rpc,
    from: vi.fn(query),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => "ok"),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: opts.session ? { user: { id: "u1" } } : null } })),
      signInWithPassword: vi.fn(async () => ({ data: { user: null }, error: null, ...opts.signIn })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
  return { client, rpc, channel, store: new SupabaseStore(client as never, { pollMs: 1000 }) };
}

const publicOrder = {
  id: ID,
  code: "GG-1001",
  mode: "dine_in",
  table: 3,
  pickupTime: null,
  status: "placed",
  bill: { lines: [], subtotal: 100, couponDiscount: 0, loyaltyDiscount: 0, pointsRedeemed: 0, taxable: 100, cgst: 2, sgst: 3, total: 105 },
  paymentStatus: "paid",
  payments: [{ id: "p1", method: "online", channel: "card", amount: 105, status: "success", createdAt: "2026-10-11T08:30:00.000Z" }],
  customerName: "Ravi",
  createdAt: "2026-10-11T08:30:00.000Z",
  updatedAt: "2026-10-11T08:31:00.000Z",
  messages: [{ id: "m1", direction: "to_customer", body: "Hi Ravi", createdAt: "2026-10-11T08:30:00.000Z" }],
};

afterEach(() => vi.useRealTimers());

describe("RPC argument mapping", () => {
  it("maps every write to its SQL function and named arguments", async () => {
    const { store, rpc } = fakeClient({ rpc: (fn) => (fn === "place_order" ? { data: { ok: false, error: "BAD_PHONE" } } : { data: publicOrder }) });
    const input = { idempotencyKey: "k", name: "A", phone: "9", marketingOptIn: false, mode: "dine_in" as const, table: 1, pickupTime: null, lines: [], couponCode: null, pointsToRedeem: 0, plan: { kind: "online" as const } };
    expect(await store.placeOrder(input)).toEqual({ ok: false, error: "BAD_PHONE" });
    await store.confirmOnlinePayment(ID, { channel: "card", amount: 105, success: true, reference: "R" });
    await store.recordCashPayment(ID, 50);
    await store.updateOrderStatus(ID, "accepted");
    await store.setItemAvailability("item", false);
    await store.updateCustomerNotes(ID, "n");
    await store.updateSettings({ tables: 4 });
    await store.sendCampaign({ name: "N", segment: "vip", body: "B" });
    await store.lookupLoyalty("98");
    await store.validateCoupon("C", 100, "98");
    await store.listOrders({ statuses: ["placed"] });
    await store.resetDemo();
    expect(rpc.mock.calls).toEqual([
      ["place_order", { payload: input }],
      ["confirm_online_payment", { p_order_id: ID, p_channel: "card", p_amount: 105, p_success: true, p_reference: "R" }],
      ["record_cash_payment", { p_order_id: ID, p_amount: 50 }],
      ["update_order_status", { p_order_id: ID, p_status: "accepted" }],
      ["set_item_availability", { p_item_id: "item", p_available: false }],
      ["update_customer_notes", { p_customer_id: ID, p_notes: "n" }],
      ["update_settings", { p_patch: { tables: 4 } }],
      ["send_campaign", { p_name: "N", p_segment: "vip", p_body: "B" }],
      ["lookup_loyalty", { p_phone: "98" }],
      ["validate_coupon", { p_code: "C", p_subtotal: 100, p_phone: "98" }],
      ["list_orders", { p_from: null, p_to: null, p_statuses: ["placed"] }],
      ["reset_demo", undefined],
    ]);
  });
});

describe("error mapping", () => {
  it("rethrows SQL error codes as Error(CODE)", async () => {
    const { store } = fakeClient({ rpc: () => ({ error: { message: "BAD_AMOUNT", code: "P0001" } }) });
    await expect(store.recordCashPayment(ID, 1)).rejects.toThrow(new Error("BAD_AMOUNT"));
  });

  it("maps permission denied (anon calling a staff function) to UNAUTHENTICATED", async () => {
    const { store } = fakeClient({ rpc: () => ({ error: { message: "permission denied for function reset_demo", code: "42501" } }) });
    await expect(store.resetDemo()).rejects.toThrow(new Error("UNAUTHENTICATED"));
    expect(errorCode({ message: "invalid input syntax for type uuid", code: "22P02" })).toBe("BAD_INPUT");
    expect(errorCode({ message: "Failed to fetch" })).toBe("Failed to fetch");
  });
});

describe("orders for customers vs staff", () => {
  it("anon getOrder uses the public view, padded to an Order with no phone or references", async () => {
    const { store, rpc } = fakeClient({ rpc: () => ({ data: publicOrder }) });
    const o = (await store.getOrder(ID))!;
    expect(rpc).toHaveBeenCalledWith("get_order_public", { p_order_id: ID });
    expect(o).toMatchObject({ id: ID, phone: "", customerId: "", customerName: "Ravi", couponCode: null, paymentStatus: "paid" });
    expect(o.payments[0].reference).toBeNull();
    expect(await store.listMessages({ orderId: ID })).toEqual([
      { id: "m1", orderId: ID, campaignId: null, to: "", direction: "to_customer", body: "Hi Ravi", createdAt: publicOrder.createdAt },
    ]);
  });

  it("non-UUID ids return null without a call", async () => {
    const { store, rpc } = fakeClient();
    expect(await store.getOrder("seed-o-1")).toBeNull();
    expect(await store.getCustomer("x")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("signed-in getOrder and listMessages use the staff functions", async () => {
    const { store, rpc } = fakeClient({ session: true, rpc: () => ({ data: [] }) });
    await store.getOrder(ID);
    await store.listMessages({ limit: 5 });
    expect(rpc.mock.calls).toEqual([
      ["get_order", { p_order_id: ID }],
      ["list_messages", { p_order_id: null, p_limit: 5 }],
    ]);
  });
});

describe("menu and settings", () => {
  it("maps rows to MenuItem and Settings", async () => {
    const { store } = fakeClient({
      tables: {
        menu_categories: [{ id: "breads", name: "Breads", sort: 1 }],
        menu_items: [
          {
            id: "b", category_id: "breads", name: "Toast", description: null, price: 45, image_url: null, is_veg: true, is_egg: null,
            tags: [], is_available: true, nutrition: null,
            item_options: [
              { id: "o2", group_name: "Add-ons", label: "Jam", price_delta: 10, sort: 1 },
              { id: "o1", group_name: "Add-ons", label: "Butter", price_delta: 5, sort: 0 },
            ],
          },
        ],
        public_settings: { cafe_name: "GG", phone: "p", whatsapp: "91", gst_percent: 5, accepting_orders: true, slot_minutes: 15, tables: 10, socials: {}, delivery: {}, hours: {}, loyalty: {} },
      },
    });
    const menu = await store.getMenu();
    expect(menu.categories).toEqual([{ id: "breads", name: "Breads", sort: 1 }]);
    expect(menu.items[0]).toEqual({
      id: "b", categoryId: "breads", name: "Toast", description: null, price: 45, veg: true, egg: null, image: null, tags: [], available: true,
      options: [
        { id: "o1", group: "Add-ons", label: "Butter", priceDelta: 5 },
        { id: "o2", group: "Add-ons", label: "Jam", priceDelta: 10 },
      ],
    });
    expect(await store.getSettings()).toMatchObject({ cafeName: "GG", gstPercent: 5, acceptingOrders: true, slotMinutes: 15, tables: 10 });
  });
});

describe("staff auth", () => {
  it("bad credentials fail; a user without a staff row is signed out", async () => {
    const bad = fakeClient({ signIn: { data: { user: null }, error: { message: "Invalid login credentials" } } });
    expect(await bad.store.staffSignIn("x@y.z", "p")).toEqual({ ok: false });
    const stranger = fakeClient({ signIn: { data: { user: { id: "u1" } }, error: null }, tables: { staff: null } });
    expect(await stranger.store.staffSignIn("x@y.z", "p")).toEqual({ ok: false });
    expect(stranger.client.auth.signOut).toHaveBeenCalled();
  });

  it("staff sign in returns the role; session reads the staff row", async () => {
    const f = fakeClient({ session: true, signIn: { data: { user: { id: "u1" } }, error: null }, tables: { staff: { role: "kitchen", name: "Kitchen" } } });
    expect(await f.store.staffSignIn(" Kitchen@GluttonsGarage.demo ", "pw")).toEqual({ ok: true, role: "kitchen" });
    expect(f.client.auth.signInWithPassword).toHaveBeenCalledWith({ email: "kitchen@gluttonsgarage.demo", password: "pw" });
    expect(await f.store.staffSession()).toEqual({ role: "kitchen", name: "Kitchen" });
  });
});

describe("subscribe", () => {
  it("staff listen to postgres_changes and remove the channel on unsubscribe", async () => {
    const f = fakeClient({ session: true });
    const off = f.store.subscribe("orders", () => {});
    await vi.waitFor(() => expect(f.channel.subscribe).toHaveBeenCalled());
    expect(f.channel.on).toHaveBeenCalledWith("postgres_changes", { event: "*", schema: "public", table: "orders" }, expect.any(Function));
    off();
    expect(f.client.removeChannel).toHaveBeenCalled();
  });

  it("customers poll get_order_public for watched orders and fire on change", async () => {
    vi.useFakeTimers();
    let status = "placed";
    const f = fakeClient({ rpc: () => ({ data: { ...publicOrder, status } }) });
    await f.store.getOrder(ID); // watch it
    let fired = 0;
    const off = f.store.subscribe("orders", () => fired++);
    await vi.advanceTimersByTimeAsync(1000); // first snapshot
    await vi.advanceTimersByTimeAsync(1000);
    expect(fired).toBe(0);
    status = "accepted";
    await vi.advanceTimersByTimeAsync(1000);
    expect(fired).toBe(1);
    off();
    status = "preparing";
    await vi.advanceTimersByTimeAsync(3000);
    expect(fired).toBe(1);
    expect(f.client.channel).not.toHaveBeenCalled();
  });
});
