import type { MenuCategory, MenuItem } from "@/data/menu";
import type { Bill, OrderMode, OrderStatus } from "@/domain/types";
import type { MessageLog, Order, Payment, Settings } from "../DataStore";

// SQL functions return DataStore-shaped JSON; only direct table reads (menu, settings) and the
// tracking-safe public order need mapping here.

export type CategoryRow = { id: string; name: string; sort: number };
export type OptionRow = { id: string; group_name: string; label: string; price_delta: number; sort: number };
export type ItemRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_veg: boolean | null;
  is_egg: boolean | null;
  tags: string[];
  is_available: boolean;
  nutrition: MenuItem["nutrition"] | null;
  item_options: OptionRow[];
};
export type SettingsRow = {
  cafe_name: string;
  phone: string;
  whatsapp: string;
  gst_percent: number;
  accepting_orders: boolean;
  slot_minutes: number;
  tables: number;
  socials: Settings["socials"];
  delivery: Settings["delivery"];
  hours: Settings["hours"];
  loyalty: Settings["loyalty"];
};

/** get_order_public(): no phone, customer id or payment references; first name only; customer messages. */
export type PublicOrder = {
  id: string;
  code: string;
  mode: OrderMode;
  table: number | null;
  pickupTime: string | null;
  status: OrderStatus;
  bill: Bill;
  paymentStatus: Order["paymentStatus"];
  payments: Omit<Payment, "reference">[];
  customerName: string | null;
  createdAt: string;
  updatedAt: string;
  messages: { id: string; direction: MessageLog["direction"]; body: string; createdAt: string }[];
};

export const toCategory = (r: CategoryRow): MenuCategory => ({ id: r.id, name: r.name, sort: r.sort });

export function toItem(r: ItemRow): MenuItem {
  const item: MenuItem = {
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    description: r.description,
    price: r.price,
    veg: r.is_veg,
    egg: r.is_egg,
    image: r.image_url,
    tags: r.tags,
    options: [...(r.item_options ?? [])]
      .sort((a, b) => a.sort - b.sort)
      .map((o) => ({ id: o.id, group: o.group_name, label: o.label, priceDelta: o.price_delta })),
    available: r.is_available,
  };
  if (r.nutrition) item.nutrition = r.nutrition;
  return item;
}

export const toSettings = (r: SettingsRow): Settings => ({
  cafeName: r.cafe_name,
  phone: r.phone,
  whatsapp: r.whatsapp,
  gstPercent: r.gst_percent,
  acceptingOrders: r.accepting_orders,
  slotMinutes: r.slot_minutes,
  tables: r.tables,
  socials: r.socials,
  delivery: r.delivery,
  hours: r.hours,
  loyalty: r.loyalty,
});

/** Staff functions return a full Order; anon gets the public subset, padded out to the Order shape. */
export function toOrder(j: Order | PublicOrder): Order {
  if ("phone" in j) return j;
  return {
    id: j.id,
    code: j.code,
    customerId: "",
    customerName: j.customerName ?? "",
    phone: "",
    mode: j.mode,
    table: j.table,
    pickupTime: j.pickupTime,
    status: j.status,
    bill: j.bill,
    couponCode: null,
    paymentStatus: j.paymentStatus,
    payments: j.payments.map((p) => ({ ...p, reference: null })),
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  };
}

export const publicMessages = (j: PublicOrder): MessageLog[] =>
  j.messages.map((m) => ({ id: m.id, orderId: j.id, campaignId: null, to: "", direction: m.direction, body: m.body, createdAt: m.createdAt }));

/**
 * SQL functions raise bare codes ("BAD_AMOUNT"); surface them as Error(code) like LocalStore.
 * Postgres "permission denied" (42501) means the anon role called a staff function.
 */
export function errorCode(e: { message?: string; code?: string }): string {
  if (e.message && /^[A-Z][A-Z0-9_]*$/.test(e.message)) return e.message;
  if (e.code === "42501") return "UNAUTHENTICATED";
  if (e.code === "22P02") return "BAD_INPUT";
  return e.message || "UNKNOWN_ERROR";
}
