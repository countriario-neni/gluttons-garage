import type { Cafe } from "@/data/cafe";
import type { MenuCategory, MenuItem } from "@/data/menu";
import type { LOYALTY } from "@/domain/loyalty";
import type { Bill, CartLine, Coupon, OrderMode, OrderStatus, PaymentMethod, PaymentPlan, Segment } from "@/domain/types";

export type Payment = {
  id: string;
  method: PaymentMethod;
  /** upi_intent|upi_id|upi_qr|card|netbanking|wallet|paylater|cash, or "pending" until confirmed. */
  channel: string;
  amount: number;
  status: "pending" | "success" | "failed";
  reference: string | null;
  createdAt: string;
};

export type Order = {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  phone: string;
  mode: OrderMode;
  table: number | null;
  pickupTime: string | null;
  status: OrderStatus;
  bill: Bill;
  couponCode: string | null;
  paymentStatus: "unpaid" | "partial" | "paid";
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
};

export type Customer = { id: string; phone: string; name: string; marketingOptIn: boolean; notes: string; createdAt: string };
export type CustomerStats = Customer & {
  orders: number;
  totalSpend: number;
  lastOrderAt: string | null;
  avgBill: number;
  favourites: string[];
  points: number;
  tags: ("new" | "regular" | "vip" | "inactive")[];
};

export type MessageLog = {
  id: string;
  orderId: string | null;
  campaignId: string | null;
  to: string;
  direction: "to_customer" | "to_cafe";
  body: string;
  createdAt: string;
};

export type Settings = {
  cafeName: string;
  phone: string;
  whatsapp: string;
  gstPercent: number;
  acceptingOrders: boolean;
  slotMinutes: number;
  tables: number;
  socials: { instagram: string; facebook: string | null };
  delivery: { swiggy: string | null; zomato: string | null };
  hours: Cafe["hours"];
  loyalty: typeof LOYALTY;
};

export type LedgerEntry = {
  id: string;
  customerId: string;
  orderId: string | null;
  points: number;
  reason: "earn" | "redeem" | "adjust";
  createdAt: string;
};

export type Campaign = { id: string; name: string; segment: Segment; body: string; sentCount: number; createdAt: string };

export type PlaceOrderInput = {
  idempotencyKey: string;
  name: string;
  phone: string;
  marketingOptIn: boolean;
  mode: OrderMode;
  table: number | null;
  pickupTime: string | null;
  lines: CartLine[];
  couponCode: string | null;
  pointsToRedeem: number;
  plan: PaymentPlan;
};
export type PlaceOrderResult = { ok: true; order: Order; onlineDue: number } | { ok: false; error: string };

export type Topic = "orders" | "menu" | "messages";
export type StaffRole = "owner" | "kitchen";

export interface DataStore {
  kind: "local" | "supabase";
  getMenu(): Promise<{ categories: MenuCategory[]; items: MenuItem[] }>;
  setItemAvailability(id: string, available: boolean): Promise<void>;
  upsertItem(i: MenuItem): Promise<void>;
  getSettings(): Promise<Settings>;
  updateSettings(p: Partial<Settings>): Promise<void>;
  lookupLoyalty(phone: string): Promise<{ points: number; isFirstOrder: boolean; name: string | null }>;
  validateCoupon(
    code: string,
    subtotal: number,
    phone: string,
  ): Promise<{ ok: true; coupon: Coupon; amount: number } | { ok: false; reason: string }>;
  placeOrder(i: PlaceOrderInput): Promise<PlaceOrderResult>;
  confirmOnlinePayment(
    orderId: string,
    p: { channel: string; amount: number; success: boolean; reference: string },
  ): Promise<Order>;
  recordCashPayment(orderId: string, amount: number): Promise<Order>;
  updateOrderStatus(orderId: string, s: OrderStatus): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  listOrders(q: { from?: string; to?: string; statuses?: OrderStatus[] }): Promise<Order[]>;
  listCustomers(): Promise<CustomerStats[]>;
  getCustomer(id: string): Promise<{ stats: CustomerStats; orders: Order[]; ledger: LedgerEntry[] } | null>;
  updateCustomerNotes(id: string, notes: string): Promise<void>;
  listCoupons(): Promise<Coupon[]>;
  upsertCoupon(c: Coupon): Promise<void>;
  listCampaigns(): Promise<Campaign[]>;
  sendCampaign(c: { name: string; segment: Segment; body: string }): Promise<Campaign>;
  listMessages(q: { orderId?: string; limit?: number }): Promise<MessageLog[]>;
  subscribe(topic: Topic, cb: () => void): () => void;
  staffSignIn(email: string, password: string): Promise<{ ok: boolean; role?: StaffRole }>;
  staffSignOut(): Promise<void>;
  staffSession(): Promise<{ role: StaffRole; name: string } | null>;
  resetDemo(): Promise<void>;
}
