import { cafe } from "@/data/cafe";
import { categories, items, type MenuCategory, type MenuItem } from "@/data/menu";
import { couponDiscount } from "@/domain/coupons";
import { LOYALTY, pointsEarned } from "@/domain/loyalty";
import { priceOrder } from "@/domain/pricing";
import type { CartLine, Coupon } from "@/domain/types";
import type { Campaign, Customer, LedgerEntry, MessageLog, Order, Payment, Settings, StaffRole } from "@/store/DataStore";

export type StaffUser = { email: string; password: string; role: StaffRole; name: string };

/** The whole demo database as persisted by LocalStore. */
export type SeedDB = {
  settings: Settings;
  categories: MenuCategory[];
  items: MenuItem[];
  customers: Customer[];
  orders: Order[];
  ledger: LedgerEntry[];
  coupons: Coupon[];
  campaigns: Campaign[];
  messages: MessageLog[];
  staff: StaffUser[];
  /** Next numeric order code ("GG-" + this). */
  nextCode: number;
  /** idempotencyKey -> orderId + onlineDue of the order it created. */
  idempotency: Record<string, { orderId: string; onlineDue: number }>;
};

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_STAFF: StaffUser[] = [
  { email: "owner@gluttonsgarage.demo", password: "garage123", role: "owner", name: "Owner" },
  { email: "kitchen@gluttonsgarage.demo", password: "garage123", role: "kitchen", name: "Kitchen" },
];

export function defaultSettings(): Settings {
  return {
    cafeName: cafe.name,
    phone: cafe.phone,
    whatsapp: cafe.whatsapp,
    gstPercent: 5,
    acceptingOrders: true,
    slotMinutes: 15,
    tables: 10,
    socials: { instagram: cafe.instagram, facebook: cafe.facebook },
    delivery: { swiggy: null, zomato: null },
    hours: structuredClone(cafe.hours),
    loyalty: { ...LOYALTY },
  };
}

const NAMES = [
  "Ravi Teja", "Lakshmi Prasanna", "Venkata Rao", "Sravani Reddy", "Harsha Vardhan", "Divya Sree", "Karthik Naidu",
  "Anusha Varma", "Srinivas Murthy", "Pavani Kumari", "Rahul Sharma", "Priya Nair", "Aditya Verma", "Sneha Iyer",
  "Rohit Mehta", "Ananya Das", "Vikram Singh", "Meera Pillai", "Arjun Reddy", "Kavya Rao", "Manoj Kumar", "Swathi Chowdary",
  "Naveen Babu", "Deepika Patel", "Sai Kiran", "Bhavana Devi", "Ramesh Gupta", "Nikhil Joshi", "Tejaswi Raju", "Pooja Menon",
  "Suresh Yadav", "Harini Krishnan", "Mohan Rao", "Isha Kapoor", "Gopi Krishna", "Madhavi Latha", "Imran Khan", "Jyothi Prakash",
  "Abhinav Bose", "Sirisha Reddy",
];

const IST_MS = 330 * 60000;
const DAY_MS = 86400000;
const pad = (n: number) => String(n).padStart(2, "0");
const CHANNELS = ["upi_intent", "upi_id", "upi_qr", "card", "netbanking", "wallet"];

/** Deterministic demo data for a given "now": 40 customers and ~21 days of orders (past ones completed and paid). */
export function generateSeed(now: Date, rng: () => number = mulberry32(42)): SeedDB {
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = <T>(a: T[]): T => a[Math.floor(rng() * a.length)];
  const nowMs = now.getTime();
  const iso = (ms: number) => new Date(ms).toISOString();

  // Customers
  const usedPhones = new Set<string>();
  const customers: Customer[] = NAMES.map((name, i) => {
    let phone: string;
    do phone = "90000" + String(int(0, 99999)).padStart(5, "0");
    while (usedPhones.has(phone));
    usedPhones.add(phone);
    return { id: `seed-c-${i + 1}`, phone, name, marketingOptIn: rng() < 0.85, notes: "", createdAt: iso(nowMs - 22 * DAY_MS) };
  });
  const weight = customers.map(() => 0.3 + rng() * 2.5);
  // The last 8 customers joined recently, so the "new" segment is populated.
  // Six customers only have old orders (35-60 days ago) so the "inactive" segment is populated.
  const lapsed = new Set([8, 9, 10, 11, 12, 13]);
  const startDay = customers.map((_, i) => (i >= customers.length - 8 ? int(0, 6) : 21));

  // Bestsellers and items with photos are ordered far more often.
  const orderable = items.filter((m) => m.available);
  const itemWeight = orderable.map(
    (m) => 1 + (m.tags.includes("Bestseller") ? 30 : 0) + (m.image ? 20 : 0) + (m.tags.includes("GG Special") ? 3 : 0),
  );
  const itemTotal = itemWeight.reduce((a, b) => a + b, 0);
  const pickItem = (): MenuItem => {
    let r = rng() * itemTotal;
    for (let i = 0; i < orderable.length; i++) if ((r -= itemWeight[i]) < 0) return orderable[i];
    return orderable[orderable.length - 1];
  };

  const coupons: Coupon[] = [
    { code: "WELCOME10", type: "percent", value: 10, minOrder: 0, maxDiscount: 100, expiresAt: null, usageLimit: null, usedCount: 0, firstOrderOnly: true, active: true },
    { code: "TIRAMISU50", type: "flat", value: 50, minOrder: 400, maxDiscount: null, expiresAt: null, usageLimit: null, usedCount: 0, firstOrderOnly: false, active: true },
    { code: "GG100", type: "flat", value: 100, minOrder: 500, maxDiscount: null, expiresAt: iso(nowMs - 30 * DAY_MS), usageLimit: null, usedCount: 0, firstOrderOnly: false, active: true },
    { code: "WINBACK15", type: "percent", value: 15, minOrder: 300, maxDiscount: 150, expiresAt: null, usageLimit: null, usedCount: 0, firstOrderOnly: false, active: true },
  ];

  const orders: Order[] = [];
  const ledger: LedgerEntry[] = [];
  const state = customers.map(() => ({ orders: 0, points: 0 }));
  const firstOrderAt: (string | undefined)[] = customers.map(() => undefined);
  let code = 1001;
  let pid = 1;
  let lid = 1;

  const istToday = new Date(nowMs + IST_MS);
  const todayStart = Date.UTC(istToday.getUTCFullYear(), istToday.getUTCMonth(), istToday.getUTCDate()) - IST_MS;

  type Live = { status: Order["status"]; mode: Order["mode"]; table: number | null; kind: "online" | "split"; agoMin: number; pickupAfterMin: number };
  const emit = (ci: number, createdMs: number, live?: Live) => {
      const cust = customers[ci];
      const st = state[ci];
      const isFirstOrder = st.orders === 0;
      const rejected = !live && rng() < 0.03;
      const mode = live ? live.mode : rng() < 0.7 ? "dine_in" : "takeaway";

      const lines: CartLine[] = [];
      const seen = new Set<string>();
      for (let n = int(1, 4); n > 0; n--) {
        const it = pickItem();
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        const optionIds = it.options.length > 0 && rng() < 0.25 ? [pick(it.options).id] : [];
        lines.push({ itemId: it.id, optionIds, qty: rng() < 0.8 ? 1 : 2 });
      }

      const createdAt = iso(createdMs);
      const base = { lines, menu: items, isFirstOrder, pointsBalance: st.points, now: new Date(createdMs) };
      const first = priceOrder({ ...base, coupon: null, pointsToRedeem: 0 });
      if (!first.ok) throw new Error(`seed pricing failed: ${first.error}`);

      let coupon: Coupon | null = null;
      if (!rejected) {
        const wanted = isFirstOrder && rng() < 0.5 ? coupons[0] : rng() < 0.06 ? coupons[1] : null;
        if (wanted && couponDiscount(wanted, first.bill.subtotal, isFirstOrder, new Date(createdMs)).ok) coupon = wanted;
      }
      const pointsToRedeem = !rejected && st.points >= LOYALTY.redeemBlock && rng() < 0.12 ? LOYALTY.redeemBlock : 0;
      const priced = priceOrder({ ...base, coupon, pointsToRedeem });
      if (!priced.ok) throw new Error(`seed pricing failed: ${priced.error}`);
      const bill = priced.bill;
      if (coupon) coupon.usedCount++;

      const orderId = `seed-o-${code}`;
      const payments: Payment[] = [];
      if (!rejected) {
        // Cash and split are dine-in only; takeaway is always online.
        const pay = rng();
        const kind = live ? live.kind : mode === "takeaway" || bill.total < 2 || pay < 0.55 ? "online" : pay < 0.85 ? "cash" : "split";
        const row = (method: "online" | "cash", amount: number): Payment => ({
          id: `seed-p-${pid++}`,
          method,
          channel: method === "cash" ? "cash" : pick(CHANNELS),
          amount,
          status: "success",
          reference: method === "cash" ? null : `DEMO${int(100000, 999999)}`,
          createdAt,
        });
        if (kind === "online") payments.push(row("online", bill.total));
        else if (kind === "cash") payments.push(row("cash", bill.total));
        else {
          const online = Math.min(bill.total - 1, Math.max(1, Math.round(bill.total * (0.3 + rng() * 0.4))));
          payments.push(row("online", online), row("cash", bill.total - online));
        }
      }

      if (live?.kind === "split") Object.assign(payments[1], { status: "pending" }); // cash still due
      const pickup = new Date(createdMs + (live?.pickupAfterMin ?? 25) * 60000 + IST_MS);
      orders.push({
        id: orderId,
        code: `GG-${code}`,
        customerId: cust.id,
        customerName: cust.name,
        phone: cust.phone,
        mode,
        table: live ? live.table : mode === "dine_in" ? int(1, 10) : null,
        pickupTime: mode === "takeaway" ? `${pad(pickup.getUTCHours())}:${pad(pickup.getUTCMinutes())}` : null,
        status: rejected ? "rejected" : (live?.status ?? "completed"),
        bill,
        couponCode: coupon ? coupon.code : null,
        paymentStatus: rejected ? "unpaid" : live?.kind === "split" ? "partial" : "paid",
        payments,
        createdAt,
        updatedAt: iso(live ? createdMs : createdMs + 20 * 60000),
      });
      code++;
      if (!rejected) {
        st.orders++;
        firstOrderAt[ci] ??= createdAt;
      }
      if (bill.pointsRedeemed > 0) {
        ledger.push({ id: `seed-l-${lid++}`, customerId: cust.id, orderId, points: -bill.pointsRedeemed, reason: "redeem", createdAt });
        st.points -= bill.pointsRedeemed;
      }
      if (!rejected && !live) {
        const earned = pointsEarned(bill.total);
        ledger.push({ id: `seed-l-${lid++}`, customerId: cust.id, orderId, points: earned, reason: "earn", createdAt: iso(createdMs + 20 * 60000) });
        st.points += earned;
      }
  };

  for (let d = 60; d >= 0; d--) {
    const dayStart = todayStart - d * DAY_MS;
    const closeMin = new Date(dayStart + IST_MS).getUTCDay() === 1 ? 20 * 60 + 30 : 22 * 60;
    const count = d > 34 ? 1 : d > 21 ? 0 : int(12, 30);
    const minutes = Array.from({ length: count }, () => {
      const r = rng();
      const m = r < 0.35 ? int(11 * 60, 13 * 60 - 1) : r < 0.8 ? int(17 * 60, 21 * 60 - 1) : int(8 * 60, 21 * 60 + 59);
      return Math.min(m, closeMin - 1);
    }).sort((a, b) => a - b);
    const active = customers.map((_, i) => i).filter((i) => (d > 21 ? lapsed.has(i) : !lapsed.has(i) && startDay[i] >= d));
    const activeTotal = active.reduce((s, i) => s + weight[i], 0);
    for (const minute of minutes) {
      const createdMs = dayStart + minute * 60000;
      // The last 25 minutes are left free for the live orders below, so codes stay chronological.
      if (createdMs > nowMs - 25 * 60000) continue;
      let r = rng() * activeTotal;
      let ci = active[active.length - 1];
      for (const i of active) {
        if ((r -= weight[i]) < 0) {
          ci = i;
          break;
        }
      }
      emit(ci, createdMs);
    }
  }

  // Three in-flight orders so the kitchen board is not empty at demo start.
  const regulars = customers.map((_, i) => i).filter((i) => !lapsed.has(i));
  const liveOrders: Live[] = [
    { status: "ready", mode: "dine_in", table: 6, kind: "split", agoMin: 24, pickupAfterMin: 25 },
    { status: "preparing", mode: "takeaway", table: null, kind: "online", agoMin: 10, pickupAfterMin: 40 },
    { status: "placed", mode: "dine_in", table: 3, kind: "online", agoMin: 3, pickupAfterMin: 25 },
  ];
  for (const l of liveOrders) emit(pick(regulars), nowMs - l.agoMin * 60000, l);

  customers.forEach((c, i) => {
    const t = firstOrderAt[i];
    if (t) c.createdAt = t;
  });

  return {
    settings: defaultSettings(),
    categories: structuredClone(categories),
    items: structuredClone(items),
    customers,
    orders,
    ledger,
    coupons,
    campaigns: [],
    messages: [],
    staff: structuredClone(DEMO_STAFF),
    nextCode: code,
    idempotency: {},
  };
}
