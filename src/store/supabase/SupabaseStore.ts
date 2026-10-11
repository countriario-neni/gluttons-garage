import type { SupabaseClient } from "@supabase/supabase-js";
import type { MenuItem } from "@/data/menu";
import type { Coupon, OrderStatus, Segment } from "@/domain/types";
import type {
  Campaign,
  CustomerStats,
  DataStore,
  LedgerEntry,
  MessageLog,
  Order,
  PlaceOrderInput,
  PlaceOrderResult,
  Settings,
  StaffRole,
  Topic,
} from "../DataStore";
import {
  type CategoryRow,
  errorCode,
  type ItemRow,
  type PublicOrder,
  publicMessages,
  type SettingsRow,
  toCategory,
  toItem,
  toOrder,
  toSettings,
} from "./mappers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Tables whose changes staff screens listen to (they are in the supabase_realtime publication). */
const TABLES: Record<Topic, string> = { orders: "orders", messages: "message_log", menu: "menu_items" };

export type SupabaseStoreOptions = { pollMs?: number };

/**
 * DataStore over Supabase. All writes and staff reads are SQL functions (security definer, role-checked);
 * the menu and public settings are plain selects allowed by RLS.
 */
export class SupabaseStore implements DataStore {
  readonly kind = "supabase" as const;
  private sb: SupabaseClient;
  private pollMs: number;
  /** Orders this browser placed or opened; anon subscribers poll these (they can't read `orders`). */
  private watched = new Set<string>();
  private channelSeq = 0;

  constructor(sb: SupabaseClient, o: SupabaseStoreOptions = {}) {
    this.sb = sb;
    this.pollMs = o.pollMs ?? 3000;
  }

  private async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error, status } = await this.sb.rpc(fn, args);
    if (error) throw new Error(errorCode({ ...error, status }));
    return data as T;
  }

  private async signedIn(): Promise<boolean> {
    const { data } = await this.sb.auth.getSession();
    return Boolean(data.session);
  }

  // ---- realtime --------------------------------------------------------------

  subscribe(topic: Topic, cb: () => void): () => void {
    let stopped = false;
    let stop = () => {};
    void this.signedIn().then((staff) => {
      if (!stopped) stop = staff ? this.listen(topic, cb) : this.poll(topic, cb);
    });
    return () => {
      stopped = true;
      stop();
    };
  }

  /** Staff: postgres_changes (RLS lets staff read these tables). */
  private listen(topic: Topic, cb: () => void): () => void {
    const ch = this.sb
      .channel(`gg-${topic}-${++this.channelSeq}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES[topic] }, () => cb())
      .subscribe();
    return () => void this.sb.removeChannel(ch);
  }

  /** Customers: poll the tracking-safe view of watched orders and fire when one changes. */
  private poll(topic: Topic, cb: () => void): () => void {
    if (topic === "menu") return () => {}; // useLive's periodic refetch covers the menu
    const last = new Map<string, string>();
    let busy = false; // skip a tick rather than overlap a slow one
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        for (const id of this.watched) {
          // A network blip (rejected promise or error result) just skips this order until the next tick.
          const res = await this.sb.rpc("get_order_public", { p_order_id: id }).then(
            (r) => r,
            () => null,
          );
          if (!res || res.error) continue;
          const snap = JSON.stringify(res.data);
          const prev = last.get(id);
          last.set(id, snap);
          if (prev !== undefined && prev !== snap) cb();
        }
      } finally {
        busy = false;
      }
    }, this.pollMs);
    return () => clearInterval(timer);
  }

  // ---- auth ------------------------------------------------------------------

  private async staffRow(userId: string): Promise<{ role: StaffRole; name: string } | null> {
    const { data } = await this.sb.from("staff").select("role, name").eq("user_id", userId).maybeSingle();
    return (data as { role: StaffRole; name: string } | null) ?? null;
  }

  async staffSignIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user) return { ok: false };
    const me = await this.staffRow(data.user.id);
    if (!me) {
      await this.sb.auth.signOut();
      return { ok: false };
    }
    return { ok: true, role: me.role };
  }
  async staffSignOut() {
    await this.sb.auth.signOut();
  }
  async staffSession() {
    const { data } = await this.sb.auth.getSession();
    return data.session ? this.staffRow(data.session.user.id) : null;
  }

  // ---- menu & settings ---------------------------------------------------------

  async getMenu() {
    const [cats, items] = await Promise.all([
      this.sb.from("menu_categories").select("id, name, sort").order("sort"),
      this.sb.from("menu_items").select("*, item_options(id, group_name, label, price_delta, sort)").order("sort"),
    ]);
    if (cats.error) throw new Error(errorCode(cats.error));
    if (items.error) throw new Error(errorCode(items.error));
    return { categories: (cats.data as CategoryRow[]).map(toCategory), items: (items.data as ItemRow[]).map(toItem) };
  }
  async setItemAvailability(id: string, available: boolean) {
    await this.rpc("set_item_availability", { p_item_id: id, p_available: available });
  }
  async upsertItem(i: MenuItem) {
    await this.rpc("upsert_item", { p_item: i });
  }
  async getSettings(): Promise<Settings> {
    const { data, error } = await this.sb.from("public_settings").select("*").single();
    if (error) throw new Error(errorCode(error));
    return toSettings(data as SettingsRow);
  }
  async updateSettings(p: Partial<Settings>) {
    await this.rpc("update_settings", { p_patch: p });
  }

  // ---- loyalty & coupons ---------------------------------------------------------

  lookupLoyalty(phone: string) {
    return this.rpc<{ points: number; isFirstOrder: boolean; name: string | null }>("lookup_loyalty", { p_phone: phone });
  }
  validateCoupon(code: string, subtotal: number, phone: string) {
    return this.rpc<{ ok: true; coupon: Coupon; amount: number } | { ok: false; reason: string }>("validate_coupon", {
      p_code: code,
      p_subtotal: subtotal,
      p_phone: phone,
    });
  }
  listCoupons() {
    return this.rpc<Coupon[]>("list_coupons");
  }
  async upsertCoupon(c: Coupon) {
    await this.rpc("upsert_coupon", { p_coupon: c });
  }

  // ---- orders ----------------------------------------------------------------------

  async placeOrder(i: PlaceOrderInput): Promise<PlaceOrderResult> {
    const r = await this.rpc<PlaceOrderResult>("place_order", { payload: i });
    if (r.ok) this.watched.add(r.order.id);
    return r;
  }
  async confirmOnlinePayment(orderId: string, p: { channel: string; amount: number; success: boolean; reference: string }) {
    const j = await this.rpc<Order | PublicOrder>("confirm_online_payment", {
      p_order_id: orderId,
      p_channel: p.channel,
      p_amount: p.amount,
      p_success: p.success,
      p_reference: p.reference,
    });
    return toOrder(j);
  }
  recordCashPayment(orderId: string, amount: number) {
    return this.rpc<Order>("record_cash_payment", { p_order_id: orderId, p_amount: amount });
  }
  updateOrderStatus(orderId: string, s: OrderStatus) {
    return this.rpc<Order>("update_order_status", { p_order_id: orderId, p_status: s });
  }

  private async publicOrder(id: string): Promise<PublicOrder | null> {
    return this.rpc<PublicOrder | null>("get_order_public", { p_order_id: id });
  }

  async getOrder(id: string): Promise<Order | null> {
    if (!UUID.test(id)) return null;
    this.watched.add(id);
    if (await this.signedIn()) {
      try {
        return await this.rpc<Order | null>("get_order", { p_order_id: id });
      } catch (e) {
        if ((e as Error).message !== "UNAUTHENTICATED") throw e; // signed in but not staff
      }
    }
    const j = await this.publicOrder(id);
    return j ? toOrder(j) : null;
  }
  listOrders(q: { from?: string; to?: string; statuses?: OrderStatus[] }) {
    return this.rpc<Order[]>("list_orders", { p_from: q.from ?? null, p_to: q.to ?? null, p_statuses: q.statuses ?? null });
  }

  // ---- customers & marketing ----------------------------------------------------------

  listCustomers() {
    return this.rpc<CustomerStats[]>("list_customers");
  }
  async getCustomer(id: string) {
    if (!UUID.test(id)) return null;
    return this.rpc<{ stats: CustomerStats; orders: Order[]; ledger: LedgerEntry[] } | null>("get_customer", { p_customer_id: id });
  }
  async updateCustomerNotes(id: string, notes: string) {
    await this.rpc("update_customer_notes", { p_customer_id: id, p_notes: notes });
  }
  listCampaigns() {
    return this.rpc<Campaign[]>("list_campaigns");
  }
  sendCampaign(c: { name: string; segment: Segment; body: string }) {
    return this.rpc<Campaign>("send_campaign", { p_name: c.name, p_segment: c.segment, p_body: c.body });
  }

  /** Staff see the message log; a customer sees the messages of an order they track. */
  async listMessages(q: { orderId?: string; limit?: number }): Promise<MessageLog[]> {
    if (await this.signedIn()) return this.rpc<MessageLog[]>("list_messages", { p_order_id: q.orderId ?? null, p_limit: q.limit ?? null });
    if (!q.orderId || !UUID.test(q.orderId)) return [];
    const j = await this.publicOrder(q.orderId);
    const rows = j ? publicMessages(j) : [];
    return q.limit ? rows.slice(0, q.limit) : rows;
  }

  async resetDemo() {
    await this.rpc("reset_demo");
  }
}
