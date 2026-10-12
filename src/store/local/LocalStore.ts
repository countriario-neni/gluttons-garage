import type { MenuItem } from "@/data/menu";
import { generateSeed, type SeedDB } from "@/data/seed";
import { couponDiscount } from "@/domain/coupons";
import { pointsEarned } from "@/domain/loyalty";
import { priceOrder } from "@/domain/pricing";
import { inSegment } from "@/domain/segments";
import type { Coupon, OrderStatus, Segment } from "@/domain/types";
import { isIndianMobile, splitRemainder } from "@/domain/validation";
import type {
  Campaign,
  DataStore,
  MessageLog,
  Order,
  Payment,
  PlaceOrderInput,
  PlaceOrderResult,
  Settings,
  StaffRole,
  Topic,
} from "../DataStore";
import { customerStats, DB_KEY, isFirstOrder, type KV, newestFirst, normPhone, paymentStatusOf, pointsBalance, SESSION_KEY } from "./db";
import { messageFor } from "./messages";

/** Structural subset of BroadcastChannel (also satisfied by test fakes). */
type ChannelLike = {
  postMessage(m: unknown): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onmessage?: ((e: any) => void) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener?: (type: "message", cb: (e: any) => void) => void;
};

export type LocalStoreOptions = {
  storage: KV;
  channel: ChannelLike | null;
  now: () => Date;
  newId?: () => string;
  /** Staff session storage (sessionStorage in the browser); in-memory when omitted. */
  session?: KV;
};

const CLOSED = new Set<OrderStatus>(["rejected", "cancelled"]);
const TOPICS: Topic[] = ["orders", "menu", "messages"];
const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  placed: ["accepted", "rejected"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["completed"],
};

function memoryKV(): KV {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

export class LocalStore implements DataStore {
  readonly kind = "local" as const;
  private storage: KV;
  private session: KV;
  private channel: ChannelLike | null;
  private now: () => Date;
  private newId: () => string;
  private listeners: Record<Topic, Set<() => void>> = { orders: new Set(), menu: new Set(), messages: new Set() };

  constructor(o: LocalStoreOptions) {
    this.storage = o.storage;
    this.session = o.session ?? memoryKV();
    this.channel = o.channel;
    this.now = o.now;
    this.newId = o.newId ?? (() => crypto.randomUUID());
    const onRemote = (e: { data: unknown }) => {
      const t = (e.data as { topic?: Topic } | null)?.topic;
      if (t && TOPICS.includes(t)) this.fire(t);
    };
    if (o.channel?.addEventListener) o.channel.addEventListener("message", onRemote);
    else if (o.channel) o.channel.onmessage = onRemote;
    // Fallback where BroadcastChannel is missing: the browser `storage` event fires in other tabs.
    if (typeof window !== "undefined" && o.storage === window.localStorage) {
      window.addEventListener("storage", (e) => {
        if (e.key === DB_KEY) TOPICS.forEach((t) => this.fire(t));
      });
    }
  }

  // ---- persistence -------------------------------------------------------

  private load(): SeedDB {
    const raw = this.storage.getItem(DB_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as SeedDB;
      } catch {
        /* corrupt: fall through and reseed */
      }
    }
    const db = generateSeed(this.now());
    this.storage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }

  /** Re-reads storage, runs `fn`, and persists + broadcasts only if `commit(result)` holds. */
  private tx<T>(topics: Topic[], fn: (db: SeedDB) => T, commit: (r: T) => boolean = () => true): T {
    const db = this.load();
    const r = fn(db);
    if (commit(r)) {
      this.storage.setItem(DB_KEY, JSON.stringify(db));
      topics.forEach((t) => {
        this.fire(t);
        this.channel?.postMessage({ topic: t });
      });
    }
    return r;
  }

  private fire(t: Topic) {
    [...this.listeners[t]].forEach((cb) => cb());
  }

  subscribe(topic: Topic, cb: () => void): () => void {
    this.listeners[topic].add(cb);
    return () => void this.listeners[topic].delete(cb);
  }

  // ---- auth --------------------------------------------------------------

  private currentStaff(): { role: StaffRole; name: string } | null {
    const raw = this.session.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as { role: StaffRole; name: string }) : null;
  }
  private requireStaff() {
    const s = this.currentStaff();
    if (!s) throw new Error("UNAUTHENTICATED");
    return s;
  }
  private requireOwner() {
    if (this.requireStaff().role !== "owner") throw new Error("FORBIDDEN");
  }

  async staffSignIn(email: string, password: string) {
    const u = this.load().staff.find((s) => s.email === email.trim().toLowerCase() && s.password === password);
    if (!u) return { ok: false };
    this.session.setItem(SESSION_KEY, JSON.stringify({ role: u.role, name: u.name }));
    return { ok: true, role: u.role };
  }
  async staffSignOut() {
    this.session.removeItem(SESSION_KEY);
  }
  async staffSession() {
    return this.currentStaff();
  }

  // ---- menu & settings ---------------------------------------------------

  async getMenu() {
    const db = this.load();
    return { categories: db.categories, items: db.items };
  }
  async setItemAvailability(id: string, available: boolean) {
    this.requireStaff();
    this.tx(["menu"], (db) => {
      const it = db.items.find((i) => i.id === id);
      if (it) it.available = available;
    });
  }
  async upsertItem(i: MenuItem) {
    this.requireOwner();
    this.tx(["menu"], (db) => {
      const idx = db.items.findIndex((x) => x.id === i.id);
      if (idx >= 0) db.items[idx] = i;
      else db.items.push(i);
    });
  }
  async getSettings(): Promise<Settings> {
    return this.load().settings;
  }
  async updateSettings(p: Partial<Settings>) {
    this.requireOwner();
    this.tx(["menu"], (db) => void (db.settings = { ...db.settings, ...p }));
  }

  // ---- loyalty & coupons -------------------------------------------------

  async lookupLoyalty(phone: string) {
    const db = this.load();
    const c = db.customers.find((x) => x.phone === normPhone(phone));
    return { points: c ? pointsBalance(db, c.id) : 0, isFirstOrder: isFirstOrder(db, c?.id), name: c?.name ?? null };
  }

  async validateCoupon(code: string, subtotal: number, phone: string) {
    const db = this.load();
    const coupon = findCoupon(db, code);
    if (!coupon) return { ok: false as const, reason: "NOT_FOUND" };
    const c = db.customers.find((x) => x.phone === normPhone(phone));
    const r = couponDiscount(coupon, subtotal, isFirstOrder(db, c?.id), this.now());
    return r.ok ? { ok: true as const, coupon, amount: r.amount } : { ok: false as const, reason: r.reason };
  }
  async listCoupons() {
    this.requireStaff();
    return this.load().coupons;
  }
  async upsertCoupon(c: Coupon) {
    this.requireOwner();
    this.tx(["menu"], (db) => {
      const next = { ...c, code: c.code.trim().toUpperCase() };
      const idx = db.coupons.findIndex((x) => x.code.toUpperCase() === next.code);
      if (idx >= 0) db.coupons[idx] = next;
      else db.coupons.push(next);
    });
  }

  // ---- orders ------------------------------------------------------------

  async placeOrder(i: PlaceOrderInput): Promise<PlaceOrderResult> {
    const seen = this.load();
    const hit = seen.idempotency[i.idempotencyKey];
    const prior = hit && seen.orders.find((o) => o.id === hit.orderId);
    if (hit && prior) return { ok: true, order: prior, onlineDue: hit.onlineDue };
    return this.tx(["orders", "messages"], (db) => this.place(db, i), (r) => r.ok);
  }

  private place(db: SeedDB, i: PlaceOrderInput): PlaceOrderResult {
    const fail = (error: string): PlaceOrderResult => ({ ok: false, error });
    const now = this.now();
    const name = i.name.trim();
    const phone = normPhone(i.phone);
    if (!db.settings.acceptingOrders) return fail("NOT_ACCEPTING");
    if (!isIndianMobile(i.phone)) return fail("BAD_PHONE");
    if (!name || name.length > 60) return fail("BAD_NAME");
    if (i.mode === "dine_in" && (!Number.isInteger(i.table) || i.table! < 1 || i.table! > db.settings.tables)) return fail("BAD_TABLE");
    if (i.mode === "takeaway" && !i.pickupTime) return fail("BAD_PICKUP");
    if (i.mode === "takeaway" && i.plan.kind !== "online") return fail("CASH_DINE_IN_ONLY");

    const existing = db.customers.find((c) => c.phone === phone);
    const balance = existing ? pointsBalance(db, existing.id) : 0;
    const first = isFirstOrder(db, existing?.id);
    const pts = i.pointsToRedeem;
    if (!Number.isFinite(pts) || !Number.isInteger(pts) || pts < 0 || pts % db.settings.loyalty.redeemBlock !== 0 || pts > balance) {
      return fail("BAD_POINTS");
    }

    const common = { lines: i.lines, menu: db.items, isFirstOrder: first, pointsBalance: balance, now };
    const pass1 = priceOrder({ ...common, coupon: null, pointsToRedeem: 0 });
    if (!pass1.ok) return fail(pass1.error);

    let coupon: Coupon | null = null;
    if (i.couponCode?.trim()) {
      coupon = findCoupon(db, i.couponCode) ?? null;
      if (!coupon) return fail("COUPON_NOT_FOUND");
      const d = couponDiscount(coupon, pass1.bill.subtotal, first, now);
      if (!d.ok) return fail(`COUPON_${d.reason}`);
    }
    const priced = priceOrder({ ...common, coupon, pointsToRedeem: pts });
    if (!priced.ok) return fail(priced.error);
    const bill = priced.bill;

    let cashDue = 0;
    let onlineDue = bill.total;
    if (i.plan.kind === "cash") [cashDue, onlineDue] = [bill.total, 0];
    else if (i.plan.kind === "split") {
      const s = splitRemainder(bill.total, i.plan.onlineAmount);
      if (!s.ok) return fail("BAD_SPLIT");
      [cashDue, onlineDue] = [s.cash, i.plan.onlineAmount];
    }

    // ---- all validation passed: mutate -----
    const createdAt = now.toISOString();
    let customer = existing;
    if (customer) Object.assign(customer, { name, marketingOptIn: i.marketingOptIn });
    else {
      customer = { id: this.newId(), phone, name, marketingOptIn: i.marketingOptIn, notes: "", createdAt };
      db.customers.push(customer);
    }
    const pending = (method: Payment["method"], amount: number): Payment => ({
      id: this.newId(), method, channel: method === "cash" ? "cash" : "pending", amount, status: "pending", reference: null, createdAt,
    });
    const payments: Payment[] = [];
    if (onlineDue > 0) payments.push(pending("online", onlineDue));
    if (cashDue > 0) payments.push(pending("cash", cashDue));

    const order: Order = {
      id: this.newId(),
      code: `GG-${db.nextCode++}`,
      customerId: customer.id,
      customerName: name,
      phone,
      mode: i.mode,
      table: i.mode === "dine_in" ? i.table : null,
      pickupTime: i.mode === "takeaway" ? i.pickupTime : null,
      status: "placed",
      bill,
      couponCode: coupon ? coupon.code : null,
      paymentStatus: "unpaid",
      payments,
      createdAt,
      updatedAt: createdAt,
    };
    db.orders.push(order);
    if (coupon) coupon.usedCount++;
    if (bill.pointsRedeemed > 0) {
      db.ledger.push({ id: this.newId(), customerId: customer.id, orderId: order.id, points: -bill.pointsRedeemed, reason: "redeem", createdAt });
    }
    db.messages.push(
      this.msg(order, phone, "to_customer", messageFor("order_placed_customer", order)),
      this.msg(order, db.settings.whatsapp, "to_cafe", messageFor("order_placed_cafe", order)),
    );
    db.idempotency[i.idempotencyKey] = { orderId: order.id, onlineDue };
    return { ok: true, order, onlineDue };
  }

  private msg(order: Order | null, to: string, direction: MessageLog["direction"], body: string, campaignId: string | null = null): MessageLog {
    return { id: this.newId(), orderId: order?.id ?? null, campaignId, to, direction, body, createdAt: this.now().toISOString() };
  }

  private orderIn(db: SeedDB, id: string): Order {
    const o = db.orders.find((x) => x.id === id);
    if (!o) throw new Error("ORDER_NOT_FOUND");
    return o;
  }

  /** The amount is always the server-computed online part of the order; the client amount is only checked against it. */
  async confirmOnlinePayment(orderId: string, p: { channel: string; amount: number; success: boolean; reference: string }) {
    let changed = false;
    return this.tx(
      ["orders", "messages"],
      (db) => {
        const o = this.orderIn(db, orderId);
        if (CLOSED.has(o.status)) throw new Error("ORDER_CLOSED");
        const online = o.payments.filter((x) => x.method === "online");
        if (online.some((x) => x.status === "success")) return o; // already paid: idempotent
        const row = online.findLast((x) => x.status === "pending") ?? online.findLast((x) => x.status === "failed");
        if (!row || p.amount !== row.amount) throw new Error("BAD_AMOUNT");
        const at = this.now().toISOString();
        const target =
          row.status === "pending" ? row : o.payments[o.payments.push({ id: this.newId(), method: "online", channel: "pending", amount: row.amount, status: "pending", reference: null, createdAt: at }) - 1];
        Object.assign(target, { channel: p.channel, reference: p.reference, status: p.success ? "success" : "failed" });
        o.paymentStatus = paymentStatusOf(o);
        o.updatedAt = at;
        if (p.success) db.messages.push(this.msg(o, o.phone, "to_customer", messageFor("payment_received", o, row.amount)));
        changed = true;
        return o;
      },
      () => changed,
    );
  }

  async recordCashPayment(orderId: string, amount: number) {
    this.requireStaff();
    return this.tx(["orders", "messages"], (db) => {
      const o = this.orderIn(db, orderId);
      if (CLOSED.has(o.status)) throw new Error("ORDER_CLOSED");
      // Cash due excludes what is paid and the online part that is still pending.
      const covered = o.payments.reduce((s, x) => (x.status === "success" || (x.status === "pending" && x.method === "online") ? s + x.amount : s), 0);
      if (!Number.isInteger(amount) || amount <= 0 || amount > o.bill.total - covered) throw new Error("BAD_AMOUNT");
      const row = o.payments.find((x) => x.method === "cash" && x.status === "pending");
      if (row) Object.assign(row, { amount, status: "success" });
      else o.payments.push({ id: this.newId(), method: "cash", channel: "cash", amount, status: "success", reference: null, createdAt: this.now().toISOString() });
      o.paymentStatus = paymentStatusOf(o);
      o.updatedAt = this.now().toISOString();
      db.messages.push(this.msg(o, o.phone, "to_customer", messageFor("payment_received", o, amount)));
      return o;
    });
  }

  async updateOrderStatus(orderId: string, s: OrderStatus) {
    this.requireStaff();
    return this.tx(["orders", "messages"], (db) => {
      const o = this.orderIn(db, orderId);
      if (!TRANSITIONS[o.status]?.includes(s)) throw new Error("BAD_TRANSITION");
      const at = this.now().toISOString();
      o.status = s;
      o.updatedAt = at;
      const entry = (points: number, reason: "earn" | "adjust") => ({ id: this.newId(), customerId: o.customerId, orderId: o.id, points, reason, createdAt: at });
      if (s === "completed") db.ledger.push(entry(pointsEarned(o.bill.total), "earn"));
      if ((s === "rejected" || s === "cancelled") && o.bill.pointsRedeemed > 0) db.ledger.push(entry(o.bill.pointsRedeemed, "adjust"));
      if (s !== "preparing") db.messages.push(this.msg(o, o.phone, "to_customer", messageFor("status_update", o)));
      return o;
    });
  }

  async getOrder(id: string) {
    return this.load().orders.find((o) => o.id === id) ?? null;
  }
  async listOrders(q: { from?: string; to?: string; statuses?: OrderStatus[] }) {
    this.requireStaff();
    return newestFirst(
      this.load().orders.filter(
        (o) => (!q.from || o.createdAt >= q.from) && (!q.to || o.createdAt <= q.to) && (!q.statuses || q.statuses.includes(o.status)),
      ),
    );
  }

  // ---- customers & marketing --------------------------------------------

  async listCustomers() {
    this.requireStaff();
    const db = this.load();
    return db.customers
      .map((c) => customerStats(db, c, this.now()))
      .sort((a, b) => (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? ""));
  }
  async getCustomer(id: string) {
    this.requireStaff();
    const db = this.load();
    const c = db.customers.find((x) => x.id === id);
    if (!c) return null;
    return {
      stats: customerStats(db, c, this.now()),
      orders: newestFirst(db.orders.filter((o) => o.customerId === id)),
      ledger: newestFirst(db.ledger.filter((l) => l.customerId === id)),
    };
  }
  async updateCustomerNotes(id: string, notes: string) {
    this.requireStaff();
    this.tx(["orders"], (db) => {
      const c = db.customers.find((x) => x.id === id);
      if (c) c.notes = notes;
    });
  }

  async listCampaigns() {
    this.requireStaff();
    return newestFirst(this.load().campaigns);
  }
  async sendCampaign(c: { name: string; segment: Segment; body: string }): Promise<Campaign> {
    this.requireOwner();
    return this.tx(["messages"], (db) => {
      const now = this.now();
      const recipients = db.customers.filter((x) => inSegment(customerStats(db, x, now), c.segment, now));
      const campaign: Campaign = { id: this.newId(), name: c.name, segment: c.segment, body: c.body, sentCount: recipients.length, createdAt: now.toISOString() };
      db.campaigns.push(campaign);
      for (const r of recipients) {
        db.messages.push(this.msg(null, r.phone, "to_customer", c.body.replaceAll("{name}", r.name.split(" ")[0]), campaign.id));
      }
      return campaign;
    });
  }
  async listMessages(q: { orderId?: string; limit?: number }) {
    // Same as the Supabase store: customers only ever see the messages of one order, never the café's own log.
    const staff = this.currentStaff();
    if (!staff && !q.orderId) return [];
    const rows = newestFirst(
      this.load().messages.filter((m) => (!q.orderId || m.orderId === q.orderId) && (staff || m.direction === "to_customer")),
    );
    return q.limit ? rows.slice(0, q.limit) : rows;
  }

  async resetDemo() {
    this.requireOwner();
    this.tx(TOPICS, (db) => void Object.assign(db, generateSeed(this.now())));
  }
}

const findCoupon = (db: SeedDB, code: string): Coupon | undefined =>
  db.coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase());

