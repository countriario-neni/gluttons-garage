# Gluttons Garage Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pitch-ready, fully clickable café website for Gluttons Garage, covering the public site, QR dine-in and takeaway ordering, every payment method, live order tracking, the staff kitchen board and CRM. It is statically hosted on GitHub Pages.

**Architecture:** Next.js App Router with static export. Every piece of business logic lives in pure TypeScript in `src/domain/`, which is unit-tested. Screens talk to a `DataStore` interface with two implementations:
- `LocalStore` (localStorage + BroadcastChannel) is used when no Supabase env is set. It syncs in real time across tabs on one device and is used for development and E2E tests.
- `SupabaseStore` (Postgres RPC + Realtime) is used when env vars are present. It syncs across devices.

External integrations (payments, WhatsApp, reviews) sit behind adapters with demo implementations.

**Tech Stack:**
- Next.js 16 (static export), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, lucide-react, motion
- zustand (cart), @supabase/supabase-js 2, qrcode, recharts
- vitest 5 for unit tests, @playwright/test for E2E, sharp for the image pipeline

**Spec:** `docs/superpowers/specs/2026-10-11-gluttons-garage-demo-design.md`

**Deviation from spec (decided during planning):** the spec assumed Supabase from day one. The user chose to build before a Supabase project exists, so `LocalStore` is added as a first-class store. That keeps the whole flow buildable and testable now, and the demo still works if Supabase is unreachable. Pricing rules live once in `src/domain/` and are mirrored in SQL. Parity is enforced by running the same fixture cases against both (Task 6).

## Global Constraints

- Static export: `output: 'export'`, `images.unoptimized: true`, `trailingSlash: true`, `basePath`/`assetPrefix` from `NEXT_PUBLIC_BASE_PATH` (empty locally, `/gluttons-garage` on Pages). No dynamic route segments: IDs go in query params (`/track/?id=`, `/t/?table=`).
- Currency is INR in whole rupees (integers). Display uses `₹1,234` (`en-IN`).
- GST is 5%, shown as CGST 2.5% + SGST 2.5%, and computed on (subtotal − discounts), rounded to the nearest rupee.
- Loyalty defaults: earn 1 point per ₹10 of the paid total (floor). Redeem 100 points = ₹50. Minimum redeem is 100 points, in multiples of 100. Redemption can't exceed 50% of (subtotal − coupon).
- Cash and split payments are for dine-in only. Takeaway must be paid fully online.
- Real café facts: Gluttons Garage, 7-5-182, Dr NTR Beach Rd, beside Aqua Sports Complex, Pandurangapuram, Visakhapatnam 530003. Phone +91 77023 68884. Hours 8:00 AM–10:00 PM, Monday until 8:30 PM. Instagram `https://www.instagram.com/gluttons_garage/`. Google rating "4.1★" linked, with no fabricated review text. Reviews shown are labelled "Sample reviews" unless real ones are supplied.
- Menu items and prices come only from `research/menu/*.json` transcriptions. Items marked `uncertain` are excluded.
- Demo UPI QR codes encode `upi://pay?pa=gluttonsgarage.demo@invalid&...` so scanning can never move real money.
- Fonts: Playfair Display (headings) + Karla (body) via `next/font/google`. The palette comes from `research/brand-notes.md` (Task 1) and is used only through CSS tokens; no raw hex in components.
- Accessibility: 4.5:1 text contrast, visible focus, 44px touch targets, `prefers-reduced-motion` respected, lucide SVG icons with no emoji icons.
- Never store card numbers. Card fields live only in component state and are cleared on close.

## Review Focus

1. **A price is tampered with in localStorage or the request.** The order total must be recomputed from the menu, never trusted from the client. Test in Task 3 (`priceOrder` ignores client prices) and Task 6 (SQL parity).
2. **The same order is submitted twice (double tap on "Pay").** Only one order should be created. Test in Task 8: the submit button is disabled while pending, and an idempotency key is passed to `placeOrder`.
3. **The QR table param is invalid or missing (`/t/?table=abc` or 999).** Show a friendly "Table not found, choose dine-in table" picker instead of crashing. Test in Task 7.
4. **The coupon makes the total negative, or loyalty and coupon are stacked past the subtotal.** The total must be ≥ 0, and redemption is capped. Test in Task 3.
5. **Takeaway is attempted outside opening hours or after the last slot.** No slots are offered and the café is shown as "Closed now", with the next opening time. Test in Task 3 (`takeawaySlots`).

---

## File Structure

```
src/
  app/                       routes (static export)
    layout.tsx, globals.css  fonts, tokens, providers
    page.tsx                 public home
    menu/page.tsx            full public menu
    order/page.tsx           ordering (mode select → menu → cart)
    t/page.tsx               QR landing → sets dine-in table → redirects to /order
    checkout/page.tsx
    track/page.tsx
    staff/(login)/page.tsx   staff login
    staff/orders|menu|tables|customers|loyalty|campaigns|reports|settings/page.tsx
  domain/                    PURE logic, no React, no IO
    types.ts  money.ts  pricing.ts  loyalty.ts  coupons.ts  slots.ts
    validation.ts (phone, vpa, card luhn/brand/expiry)  segments.ts  reports.ts
  data/
    cafe.ts                  real café facts
    menu.ts                  generated from research transcriptions
    seed.ts                  deterministic seed generator (customers, orders)
  store/
    DataStore.ts             interface
    local/LocalStore.ts      localStorage + BroadcastChannel
    supabase/SupabaseStore.ts
    index.ts                 picks implementation from env; React context + hooks
  integrations/
    payments/{types.ts,demo.ts,razorpay.ts}
    whatsapp/{templates.ts,demo.ts}
    reviews/{sample.ts}
  components/
    site/   Header, Footer, Hero, MenuPreview, Highlights, Reviews, Gallery, Location, WhatsAppFab
    order/  ModeSelect, MenuBrowser, ItemSheet, CartBar, CartDrawer
    checkout/ CheckoutForm, BillSummary, PaymentSheet, methods/{Upi,UpiQr,Card,Netbanking,Wallet,PayLater}
    track/  StatusStepper, WhatsAppPreview
    staff/  StaffShell, OrderBoard, OrderCard, SettleCashDialog, ...
    ui/     shadcn components
  lib/ cart.ts (zustand), format.ts, basePath.ts
supabase/migrations/0001_schema.sql 0002_functions.sql 0003_rls.sql ; supabase/seed.sql
scripts/ build-menu.mjs  process-images.mjs  gen-seed-sql.mjs
tests/unit/**  tests/e2e/**
.github/workflows/pages.yml
```

---

### Task 1: Scaffold, design tokens, and project tooling

**Files:** Create the Next app at the repo root, plus `next.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/basePath.ts`, `vitest.config.ts`, `playwright.config.ts`, `design-system/MASTER.md`, `CLAUDE.md`

**Interfaces — Produces:** `withBase(path: string): string`. CSS tokens: `--background --foreground --primary --primary-foreground --accent --accent-foreground --muted --muted-foreground --card --border --ring --success --warning --destructive`. Font CSS vars: `--font-display` (Playfair Display) and `--font-sans` (Karla).

- [ ] Step 1: Run `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes` (folder already has `docs/`, `research/` and `.gitignore`; keep them).
- [ ] Step 2: Run `npx shadcn@latest init -d`, then add: button card dialog sheet drawer input label textarea select tabs badge separator sonner switch checkbox radio-group table dropdown-menu avatar skeleton scroll-area tooltip popover calendar.
- [ ] Step 3: Install `zustand @supabase/supabase-js qrcode motion recharts lucide-react` and dev deps `vitest @vitejs/plugin-react jsdom @testing-library/react @playwright/test sharp @types/qrcode`.
- [ ] Step 4: Set up `next.config.ts`:
```ts
import type { NextConfig } from "next";
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const config: NextConfig = { output: "export", trailingSlash: true, images: { unoptimized: true }, basePath: base || undefined, assetPrefix: base || undefined };
export default config;
```
- [ ] Step 5: Add `src/lib/basePath.ts`: `export const withBase = (p: string) => \`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}\`;` This is used for raw `<img>` and `public/` asset URLs.
- [ ] Step 6: Build the palette from `research/brand-notes.md` and put the tokens in `globals.css` under `@theme` (light theme first; the staff area also gets a dark kitchen theme via `.theme-kitchen`). Check that each text/background pair is ≥ 4.5:1 with a small node script. Record the palette, type scale, radius, shadows and motion rules in `design-system/MASTER.md`.
- [ ] Step 7: Add scripts `"test": "vitest run"` and `"e2e": "playwright test"`. Playwright uses `webServer: { command: "npx serve out -l 4173", url: "http://localhost:4173" }`, with `npm run build` run first.
- [ ] Step 8: Run `npm run build`. Expected: the `out/` folder exists. Run `npm test`. Expected: "no tests" exits 0 (add `passWithNoTests`).
- [ ] Step 9: Write a project `CLAUDE.md` (commands, architecture summary, store switch, constraints). Commit with `chore: scaffold next static export with design tokens`.

### Task 2: Real menu data and image pipeline

**Files:** Create `scripts/build-menu.mjs`, `scripts/process-images.mjs`, `src/data/menu.ts`, `src/data/cafe.ts`, `public/images/**`. Test: `tests/unit/menu.test.ts`

**Interfaces — Produces:**
```ts
export type MenuOption = { id: string; group: string; label: string; priceDelta: number };
export type MenuItem = { id: string; categoryId: string; name: string; description: string | null; price: number; veg: boolean | null; egg: boolean | null; image: string | null; tags: string[]; options: MenuOption[]; available: boolean };
export type MenuCategory = { id: string; name: string; sort: number };
export const categories: MenuCategory[]; export const items: MenuItem[];
export const cafe = { name, tagline, address, phone, phoneE164: "+917702368884", whatsapp: "917702368884", instagram, mapsUrl, mapsEmbed, hours: { [day: number]: { open: "08:00", close: "22:00" } }, amenities: string[], rating: { value: 4.1, source: "Google" } };
```
- [ ] Step 1: `build-menu.mjs` reads `research/menu/*.json` and keeps `kind === "menu_page"` and items with `!uncertain && price > 0`. It slugifies ids (`category-name`), merges duplicate sections across pages, and turns `variants` into options with `group: "Size"` (base price = cheapest variant; `priceDelta` = difference). It writes `src/data/menu.ts` with a "GENERATED, do not edit" banner.
- [ ] Step 2: `process-images.mjs` uses sharp to turn the selected photos from `research/photos.json` (`use_for != "skip"`, quality ≥ 3) into `public/images/{hero,gallery,menu}/<name>.webp` at widths 640/1280, quality 78. It maps `dish_guess` to menu items by fuzzy name match (normalise lowercase, alphanumerics only, token overlap ≥ 0.6) and writes the image path into `menu.ts`.
- [ ] Step 3: Write the failing test:
```ts
import { items, categories } from "@/data/menu";
test("menu is real and consistent", () => {
  expect(items.length).toBeGreaterThan(30);
  const catIds = new Set(categories.map(c => c.id));
  for (const i of items) { expect(catIds.has(i.categoryId)).toBe(true); expect(Number.isInteger(i.price) && i.price > 0).toBe(true); }
  expect(new Set(items.map(i => i.id)).size).toBe(items.length);
});
```
- [ ] Step 4: Run the scripts, then run `npx vitest run tests/unit/menu.test.ts`. Expected: PASS.
- [ ] Step 5: Commit `feat: real menu data and optimised images`.

### Task 3: Domain logic (pricing, coupons, loyalty, slots, validation)

**Files:** Create `src/domain/{types,money,pricing,coupons,loyalty,slots,validation}.ts`. Tests: `tests/unit/domain/*.test.ts`

**Interfaces — Produces:**
```ts
// types.ts
export type OrderMode = "dine_in" | "takeaway";
export type OrderStatus = "placed" | "accepted" | "preparing" | "ready" | "completed" | "rejected" | "cancelled";
export type PaymentMethod = "online" | "cash";
export type PaymentPlan = { kind: "online" } | { kind: "cash" } | { kind: "split"; onlineAmount: number };
export type CartLine = { itemId: string; optionIds: string[]; qty: number; note?: string };
export type Coupon = { code: string; type: "percent" | "flat"; value: number; minOrder: number; maxDiscount: number | null; expiresAt: string | null; usageLimit: number | null; usedCount: number; firstOrderOnly: boolean; active: boolean };
export type PricedLine = CartLine & { name: string; unitPrice: number; lineTotal: number; optionLabels: string[] };
export type Bill = { lines: PricedLine[]; subtotal: number; couponDiscount: number; loyaltyDiscount: number; pointsRedeemed: number; taxable: number; cgst: number; sgst: number; total: number };
// pricing.ts
export function priceOrder(input: { lines: CartLine[]; menu: MenuItem[]; coupon?: Coupon | null; isFirstOrder: boolean; pointsToRedeem: number; pointsBalance: number; now: Date }): { ok: true; bill: Bill } | { ok: false; error: "ITEM_UNAVAILABLE" | "EMPTY_CART" | "BAD_QTY"; itemId?: string };
// coupons.ts
export function couponDiscount(c: Coupon, subtotal: number, isFirstOrder: boolean, now: Date): { ok: true; amount: number } | { ok: false; reason: "EXPIRED" | "INACTIVE" | "MIN_ORDER" | "LIMIT" | "FIRST_ORDER_ONLY" };
// loyalty.ts
export const LOYALTY = { earnPerRupees: 10, redeemBlock: 100, redeemValue: 50, maxShare: 0.5 };
export function pointsEarned(totalPaid: number): number;
export function maxRedeemablePoints(balance: number, base: number): number; // multiples of 100, value ≤ 50% of base
// slots.ts
export function takeawaySlots(now: Date, hours: Cafe["hours"], slotMinutes = 15, prepMinutes = 20): string[]; // "HH:MM" local
export function openStatus(now: Date, hours): { open: boolean; label: string }; // "Open · closes 10:00 PM" | "Closed · opens 8:00 AM"
// validation.ts
export const isIndianMobile = (s: string) => /^[6-9]\d{9}$/.test(s.replace(/\D/g, "").slice(-10)) && s.replace(/\D/g,"").length >= 10;
export const isVpa = (s: string) => /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(s);
export function luhn(num: string): boolean; export function cardBrand(num: string): "visa"|"mastercard"|"rupay"|"amex"|"unknown"; export function validExpiry(mmYY: string, now: Date): boolean;
export function splitRemainder(total: number, online: number): { ok: true; cash: number } | { ok: false; reason: "RANGE" }; // 1 ≤ online ≤ total-1
```
- [ ] Step 1: Write the failing tests (one file per module). Required cases:
```ts
// pricing
it("recomputes from menu, ignoring client price", ...)                       // Review Focus 1
it("option deltas add to unit price; lineTotal = unit*qty", ...)
it("GST 5% on taxable split 2.5/2.5, rounded to rupee; total = taxable + cgst + sgst", ...)
it("rejects unavailable item", ...); it("rejects qty <1 or >50", ...)
it("coupon + loyalty never make total negative; loyalty capped at 50% of subtotal-coupon", ...) // Review Focus 4
// coupons: percent with maxDiscount cap; flat ≤ subtotal; expired; minOrder; usage limit; firstOrderOnly
// loyalty: pointsEarned(999)=99; maxRedeemablePoints(350, 400)=300 (₹150 ≤ ₹200); maxRedeemablePoints(350,100)=100
// slots: at 21:50 Tue no slots + openStatus closed after 22:00; Monday last slot ≤ 20:30; first slot ≥ now+20min rounded up to 15  // Review Focus 5
// validation: luhn("4111111111111111") true; cardBrand("6522...")="rupay"; cardBrand("3782...")="amex"; validExpiry("01/20") false; isVpa("name@okhdfc") true; splitRemainder(500, 500) RANGE
```
- [ ] Step 2: Run `npx vitest run tests/unit/domain`. Expected: FAIL (modules missing).
- [ ] Step 3: Implement the modules to satisfy the tests. Rounding is `Math.round` on rupees, applied once at the tax step. `loyaltyDiscount = (points/100)*50`.
- [ ] Step 4: Run the tests. Expected: all PASS.
- [ ] Step 5: Commit `feat(domain): pricing, coupons, loyalty, slots, validation`.

### Task 4: DataStore interface, LocalStore, and seed

**Files:** Create `src/store/DataStore.ts`, `src/store/local/LocalStore.ts`, `src/data/seed.ts`, `src/store/index.ts` (context + hooks). Tests: `tests/unit/store/LocalStore.test.ts`

**Interfaces — Produces:**
```ts
export type Order = { id: string; code: string; customerId: string; customerName: string; phone: string; mode: OrderMode; table: number | null; pickupTime: string | null; status: OrderStatus; bill: Bill; couponCode: string | null; paymentStatus: "unpaid" | "partial" | "paid"; payments: Payment[]; createdAt: string; updatedAt: string };
export type Payment = { id: string; method: PaymentMethod; channel: string /* upi_intent|upi_id|upi_qr|card|netbanking|wallet|paylater|cash */; amount: number; status: "pending" | "success" | "failed"; reference: string | null; createdAt: string };
export type Customer = { id: string; phone: string; name: string; marketingOptIn: boolean; notes: string; createdAt: string };
export type CustomerStats = Customer & { orders: number; totalSpend: number; lastOrderAt: string | null; avgBill: number; favourites: string[]; points: number; tags: ("new"|"regular"|"vip"|"inactive")[] };
export type MessageLog = { id: string; orderId: string | null; campaignId: string | null; to: string; direction: "to_customer" | "to_cafe"; body: string; createdAt: string };
export type PlaceOrderInput = { idempotencyKey: string; name: string; phone: string; marketingOptIn: boolean; mode: OrderMode; table: number | null; pickupTime: string | null; lines: CartLine[]; couponCode: string | null; pointsToRedeem: number; plan: PaymentPlan };
export type PlaceOrderResult = { ok: true; order: Order; onlineDue: number } | { ok: false; error: string };
export interface DataStore {
  kind: "local" | "supabase";
  getMenu(): Promise<{ categories: MenuCategory[]; items: MenuItem[] }>;
  setItemAvailability(id: string, available: boolean): Promise<void>; upsertItem(i: MenuItem): Promise<void>;
  getSettings(): Promise<Settings>; updateSettings(p: Partial<Settings>): Promise<void>;
  lookupLoyalty(phone: string): Promise<{ points: number; isFirstOrder: boolean; name: string | null }>;
  validateCoupon(code: string, subtotal: number, phone: string): Promise<{ ok: true; coupon: Coupon; amount: number } | { ok: false; reason: string }>;
  placeOrder(i: PlaceOrderInput): Promise<PlaceOrderResult>;
  confirmOnlinePayment(orderId: string, p: { channel: string; amount: number; success: boolean; reference: string }): Promise<Order>;
  recordCashPayment(orderId: string, amount: number): Promise<Order>;
  updateOrderStatus(orderId: string, s: OrderStatus): Promise<Order>;
  getOrder(id: string): Promise<Order | null>; listOrders(q: { from?: string; to?: string; statuses?: OrderStatus[] }): Promise<Order[]>;
  listCustomers(): Promise<CustomerStats[]>; getCustomer(id: string): Promise<{ stats: CustomerStats; orders: Order[]; ledger: LedgerEntry[] } | null>; updateCustomerNotes(id: string, notes: string): Promise<void>;
  listCoupons(): Promise<Coupon[]>; upsertCoupon(c: Coupon): Promise<void>;
  listCampaigns(): Promise<Campaign[]>; sendCampaign(c: { name: string; segment: Segment; body: string }): Promise<Campaign>;
  listMessages(q: { orderId?: string; limit?: number }): Promise<MessageLog[]>;
  subscribe(topic: "orders" | "menu" | "messages", cb: () => void): () => void;
  staffSignIn(email: string, password: string): Promise<{ ok: boolean; role?: "owner" | "kitchen" }>; staffSignOut(): Promise<void>; staffSession(): Promise<{ role: "owner" | "kitchen"; name: string } | null>;
  resetDemo(): Promise<void>;
}
```
- [ ] Step 1: Write the failing tests against `new LocalStore(memoryStorage, fakeChannel, () => fixedNow)`:
  - `placeOrder` stores the order, upserts the customer by phone and writes 2 message logs (to the customer and to the café).
  - The same `idempotencyKey` twice returns the same order id (Review Focus 2).
  - A cash plan on takeaway gives `{ok:false, error:"CASH_DINE_IN_ONLY"}`.
  - `confirmOnlinePayment` with success sets paymentStatus to paid (online plan) or partial (split).
  - `recordCashPayment` for the remainder sets it to paid; an amount above the due amount is rejected.
  - `updateOrderStatus("completed")` adds a loyalty ledger entry of `pointsEarned(total)` and a WhatsApp message.
  - A redemption creates a negative ledger entry.
  - `subscribe("orders")` fires after `placeOrder`.
- [ ] Step 2: Run the tests. Expected: FAIL.
- [ ] Step 3: Implement LocalStore:
  - Data goes in one JSON doc under key `gg-demo-v1`.
  - Changes are broadcast on `BroadcastChannel("gg-demo")` and also on the `storage` event as a fallback.
  - Pricing goes through `priceOrder` only.
  - Order code format is `GG-` + 4 digits, sequential.
  - Staff demo accounts are `owner@gluttonsgarage.demo` / `garage123` (owner) and `kitchen@gluttonsgarage.demo` / `garage123` (kitchen). The session is stored in sessionStorage.
- [ ] Step 4: `seed.ts`: `generateSeed(now: Date, rng = mulberry32(42))` creates 40 customers (Indian first and last names, phone numbers `90000xxxxx` labelled sample) and ~21 days of orders.
  - Volume is 12–30 orders per day, peaking at 11–13 and 17–21.
  - Mix: 70% dine-in. Payments: 55% online, 30% cash, 15% split.
  - Items are weighted toward bestsellers. Statuses are completed for past days.
  - Also creates 3 coupons (`WELCOME10` 10% first order max ₹100; `TIRAMISU50` flat ₹50 min ₹400; `GG100` expired) and a ledger consistent with orders.
  - Test that the seed is deterministic and the ledger sum equals the sum of earned points minus redeemed.
- [ ] Step 5: `store/index.ts`: `createStore()` returns a SupabaseStore if both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, otherwise a LocalStore. It also provides `StoreProvider`, `useStore()` and `useLive(topic, loader)` (re-runs the loader on subscribe events and on a 15 s interval when `kind==="supabase"`).
- [ ] Step 6: Run the tests. Expected: PASS. Commit `feat(store): DataStore interface, LocalStore with realtime tabs, seed`.

### Task 5: Integrations — payments, WhatsApp templates, reviews

**Files:** Create `src/integrations/payments/{types,demo,razorpay}.ts`, `src/integrations/whatsapp/templates.ts`, `src/integrations/reviews/sample.ts`. Tests: `tests/unit/integrations/*.test.ts`

**Interfaces — Produces:**
```ts
export type PayChannel = "upi_intent" | "upi_id" | "upi_qr" | "card" | "netbanking" | "wallet" | "paylater";
export type PayRequest = { orderId: string; orderCode: string; amount: number; customer: { name: string; phone: string } };
export type PayResult = { success: boolean; channel: PayChannel; reference: string; failureReason?: string };
export function upiUri(r: PayRequest): string; // upi://pay?pa=gluttonsgarage.demo@invalid&pn=Gluttons%20Garage&am=<amount>.00&cu=INR&tn=Order%20<code>&tr=<orderId>
export async function simulatePayment(channel: PayChannel, r: PayRequest, opts: { forceFail?: boolean; delayMs?: number }): Promise<PayResult>; // ref "pay_DEMO" + 14 alnum
export function razorpayAvailable(): boolean; export async function razorpayCheckout(r: PayRequest): Promise<PayResult>; // loads checkout.js; test mode only
// whatsapp/templates.ts
export const templates: { orderReceivedCustomer(o: Order): string; orderReceivedCafe(o: Order): string; statusUpdate(o: Order): string; paymentReceived(o: Order, amount: number): string; campaign: Record<string, string> };
export function waLink(phone: string, text: string): string; // https://wa.me/<phone>?text=<encoded>
export function orderShareText(o: Order): string;
```
- [ ] Step 1: Failing tests: `upiUri` contains `pa=gluttonsgarage.demo%40invalid` or `@invalid`, `am=450.00` and `cu=INR`; `simulatePayment` with `forceFail` returns `success:false`; `waLink` encodes newlines as `%0A`; the order template includes the code, items, total and table/pickup.
- [ ] Step 2: Implement. Demo payment failure is triggered by the demo-only "Simulate failure" toggle in the sheet or the test UPI ID `failure@razorpay`, which mirrors Razorpay's own test convention.
- [ ] Step 3: `reviews/sample.ts` holds 6 short sample reviews referencing real dishes from listings (Tiramisu French Toast, Japanese Honey Toast, Nutella Pancake, cappuccino, Peri Peri Maggi fries, mushroom cream soup), with first names only and `isSample: true`.
- [ ] Step 4: Tests pass. Commit `feat(integrations): demo payments, whatsapp templates, sample reviews`.

### Task 6: Supabase schema, functions, RLS, seed SQL, and SupabaseStore

**Files:** Create `supabase/migrations/0001_schema.sql`, `0002_functions.sql`, `0003_rls.sql`, `scripts/gen-seed-sql.mjs` → `supabase/seed.sql`, `src/store/supabase/SupabaseStore.ts`, `tests/parity/fixtures.json`, `tests/parity/parity.test.ts` (skipped unless `SUPABASE_TEST_URL` is set), and `docs/SUPABASE_SETUP.md`.

- [ ] Step 1: The schema follows spec §3 exactly. Add `orders.idempotency_key text unique`. Money columns are `integer`. Add `alter publication supabase_realtime add table orders, message_log, menu_items;`.
- [ ] Step 2: Functions (`security definer`, `set search_path = public`):
  - `place_order(payload jsonb) returns jsonb` mirrors `priceOrder`: same GST rounding, same coupon rules, same loyalty cap, same CASH_DINE_IN_ONLY rule, same idempotency.
  - `confirm_online_payment`, `record_cash_payment` (staff only, checked via `is_staff()`), `update_order_status` (staff only; awards loyalty on completed; writes message_log), `get_order_public(id uuid)`, `lookup_loyalty(phone text)`, `validate_coupon(code, subtotal, phone)`, `send_campaign(...)` (owner only), and `reset_demo()` (owner only; truncates and re-seeds from the `seed_*` tables).
- [ ] Step 3: RLS. Anon gets select on menu/categories/options/tables/public settings and execute on the public functions only. Staff (`exists(select 1 from staff where user_id = auth.uid())`) get everything; the kitchen role can't write coupons/campaigns/settings.
- [ ] Step 4: `gen-seed-sql.mjs` reuses `generateSeed` (via `tsx`) to produce `seed.sql`, so both stores start from identical data.
- [ ] Step 5: SupabaseStore implements DataStore by calling RPCs. `subscribe` uses `channel().on("postgres_changes", ...)` for staff. Customers can't subscribe to `orders` under RLS, so customer tracking polls `get_order_public` every 3 s and also listens on a broadcast channel `order:<id>` that `update_order_status` triggers via `realtime.send` (fallback: polling).
- [ ] Step 6: The parity test runs every fixture through both `priceOrder` and `place_order` and asserts equal bills. It is skipped without credentials, and the plan notes it **must run once credentials arrive**.
- [ ] Step 7: `docs/SUPABASE_SETUP.md` covers creating the project (Mumbai), running the migrations + seed in the SQL editor, creating the two staff auth users and inserting `staff` rows, and setting repo variables. Commit `feat(supabase): schema, functions, RLS, store`.

### Task 7: Public site

**Files:** `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/menu/page.tsx`, `src/components/site/*`, `src/app/t/page.tsx`. Tests: `tests/e2e/public.spec.ts`

- [ ] Step 1: Write the failing E2E checks:
  - The home page shows "Gluttons Garage" in the h1.
  - The Call link has `href="tel:+917702368884"`.
  - The WhatsApp FAB's href starts with `https://wa.me/917702368884`.
  - The Instagram link points to the profile.
  - Reviews show the label "Sample reviews".
  - `/menu/` lists every category.
  - `/t/?table=abc` shows the "Choose your table" picker (Review Focus 3), and `/t/?table=7` redirects to `/order/` with "Table 7" visible.
- [ ] Step 2: Build the sections, using real photos and following `design-system/MASTER.md`:
  - **Sticky header:** logo, nav, open/closed badge from `openStatus`, "Order now" CTA.
  - **Hero:** full-bleed real café/food photo with a gradient scrim. Headline is "Fusion food, speciality coffee & desserts on Beach Road". CTAs: Order now, Book a table (wa.me with a pre-filled booking text), Call.
  - **"Guest favourites" rail:** bestsellers from the menu with images.
  - **Highlights:** Tiramisu Fest, Mango Mania, Events at GG, as illustrated cards linking to Instagram.
  - **Experience strip:** amenities with lucide icons.
  - **Reviews:** "4.1★ on Google" with a link, plus a carousel of sample reviews and a visible "Sample reviews" label.
  - **Gallery:** masonry of real photos, linking to Instagram.
  - **Location:** maps iframe, address, hours table with today highlighted, call/WhatsApp/directions buttons.
  - **Footer:** socials (Instagram, Facebook, WhatsApp); delivery links are shown only if configured.
  - **WhatsAppFab:** fixed bottom-right, 56px, with a tooltip. It's hidden on `/staff`, and on mobile `/order` it sits above the cart bar.
  - **Motion:** fade/slide-up reveal on scroll (motion `whileInView`, 300–450 ms), disabled under reduced motion.
- [ ] Step 3: `t/page.tsx` validates the table against `settings.tables`, writes `{mode:"dine_in", table}` to the cart store and calls `router.replace(withBase("/order/"))`.
- [ ] Step 4: Run `npm run build && npx playwright test tests/e2e/public.spec.ts`. Expected: PASS. Commit `feat(site): public website with real content`.

### Task 8: Ordering, cart, checkout, and payment sheet

**Files:** `src/lib/cart.ts`, `src/app/order/page.tsx`, `src/components/order/*`, `src/app/checkout/page.tsx`, `src/components/checkout/**`. Tests: `tests/unit/cart.test.ts`, `tests/e2e/order.spec.ts`

**Interfaces — Produces:** `useCart` (zustand + `persist` to `gg-cart`): `{ mode, table, pickupTime, lines, add(line), setQty(index, qty), remove(index), setMode(mode, table?), setPickup(t), clear() }`. Identical item + options + note lines merge.

- [ ] Step 1: Unit test the cart merge and persistence, then write E2E tests:
  - (a) `/t/?table=4` → add 2 items with options → checkout → name/phone → pay online via **UPI QR** → "Simulate payment received" → lands on `/track/?id=` showing "Paid".
  - (b) Takeaway: choose a slot → pay by **card** `4111 1111 1111 1111`, `12/30`, `123` → success.
  - (c) Takeaway hides the cash and split options.
  - (d) Double-clicking "Place order" creates exactly one order (Review Focus 2).
  - (e) An invalid card number shows an inline error.
- [ ] Step 2: `/order` layout:
  - The mode select runs if no mode is set (Dine-in: table number picker; Takeaway: slot chips from `takeawaySlots`, or a "Closed now" state).
  - Sticky category tabs with scroll-spy, search, and a veg-only toggle.
  - Item cards show image, veg/egg mark, price and an Add button. The ItemSheet (Drawer on mobile, Dialog on desktop) has options, note and a qty stepper.
  - A sticky CartBar shows the item count and total, opening a CartDrawer.
- [ ] Step 3: `/checkout` layout:
  - Contact (name, phone with `isIndianMobile`, WhatsApp opt-in checkbox, default on).
  - Loyalty: on phone blur, `lookupLoyalty` runs and shows "You have 240 points — redeem 200 for ₹100", with a toggle.
  - Coupon field using `validateCoupon`.
  - BillSummary shows the subtotal, coupon, loyalty, CGST and SGST lines, and the total.
  - Payment plan radio: Pay online / Pay at counter (cash) / Split (online amount input with `splitRemainder`), the last two dine-in only.
  - The "Place order" button is disabled while pending and generates an idempotency key once per checkout session.
- [ ] Step 4: PaymentSheet (opens after `placeOrder` when `onlineDue > 0`) is a Razorpay-grade UI:
  - The header shows Gluttons Garage, the amount and the order code.
  - Left rail (tabs on mobile):
    - **UPI**: app intent buttons (GPay, PhonePe, Paytm, BHIM; real `upi://` intent on Android, demo confirm on desktop) and a UPI ID field.
    - **Scan QR**: `qrcode` canvas from `upiUri`, a 5:00 countdown, "Waiting for payment…" pulse, and "Simulate payment received".
    - **Cards**: number with brand icon, expiry, CVV, name, and "Save card" hidden.
    - **Netbanking**: grid of SBI/HDFC/ICICI/Axis/Kotak/Yes + select of others.
    - **Wallets**: Paytm, PhonePe, Amazon Pay, Mobikwik.
    - **Pay Later**: Simpl, LazyPay, ICICI PayLater.
  - On submit, a processing state (1.2–2 s) then a success tick animation. Then `confirmOnlinePayment` runs and the customer is routed to `/track/`.
  - On failure there's a retry, or switching to cash for dine-in.
  - A footer line reads "Secured by Razorpay (demo mode)". If `razorpayAvailable()`, the sheet offers the real Razorpay test checkout instead.
- [ ] Step 5: Run the E2E tests. Expected: PASS. Commit `feat(order): QR dine-in/takeaway ordering, checkout, all payment methods`.

### Task 9: Order tracking and WhatsApp preview

**Files:** `src/app/track/page.tsx`, `src/components/track/*`. Tests: `tests/e2e/track.spec.ts`

- [ ] Step 1: Failing E2E with two browser contexts sharing storage (LocalStore cross-tab): the customer tracking page shows "Placed". In the staff tab, Accept then Ready. Within 3 s the customer sees "Ready" and the WhatsApp preview shows the "ready" message.
- [ ] Step 2: Build the page:
  - Big order code and mode/table/pickup line.
  - A StatusStepper (Placed → Accepted → Preparing → Ready → Completed; a rejected state uses the destructive style).
  - Payment summary showing paid/due amounts and a "Pay remaining at counter" note.
  - An itemised bill with "Download bill", a printable invoice route section using `window.print()` with print CSS. It includes "GSTIN: to be added" as an explicit placeholder because the real GSTIN isn't known.
  - The WhatsAppPreview phone mockup lists `listMessages({orderId})` as chat bubbles with timestamps, under a "Live WhatsApp messages (demo preview)" heading.
  - A "Send order on WhatsApp" button (real wa.me link with `orderShareText`) and a "Call café" button.
- [ ] Step 3: Tests pass. Commit `feat(track): live order tracking with whatsapp preview`.

### Task 10: Staff shell, login, and live kitchen board

**Files:** `src/app/staff/**/page.tsx` (login + orders), `src/components/staff/{StaffShell,OrderBoard,OrderCard,SettleCashDialog,RequireStaff}.tsx`, `public/sounds/new-order.mp3` (generate a short chime with WebAudio at runtime instead of shipping a binary). Tests: `tests/e2e/staff.spec.ts`

- [ ] Step 1: Failing E2E:
  - The login page shows the demo credentials hint, and wrong credentials show an error.
  - After login, `/staff/orders/` shows 3 columns.
  - A new customer order (another page) appears in "New" within 3 s with a highlight.
  - Accept → card moves to Preparing; Ready → Ready column.
  - Settle cash on a split order sets the badge to "Paid".
  - The kitchen role can't see Settings in the nav.
- [ ] Step 2: StaffShell is a sidebar on desktop and a bottom nav (≤5 items + "More") on tablet/mobile.
  - Shows the store kind ("Live sync: Supabase" or "Demo mode: this device") and the user role.
  - "Reset demo" (owner) has a confirmation built as an in-app Dialog, not `window.confirm`.
- [ ] Step 3: OrderBoard uses `useLive("orders")`.
  - New orders trigger a WebAudio chime (enabled via a "Enable sound" button on first visit to satisfy autoplay policy) and a toast.
  - Cards show elapsed time (amber after 10 min, red after 20 min), with action buttons ≥44px.
  - Uses the dark kitchen theme for readability.
- [ ] Step 4: Tests pass. Commit `feat(staff): login and live kitchen board`.

### Task 11: Menu admin and table QR codes

**Files:** `src/app/staff/menu/page.tsx`, `src/app/staff/tables/page.tsx`, `src/components/staff/{MenuEditor,TableQrCard}.tsx`. Tests: `tests/e2e/staff-menu.spec.ts`

- [ ] Step 1: Failing E2E: toggling an item to "Sold out" in admin makes the public `/order/` show it disabled within 3 s; `/staff/tables/` renders 10 QR cards whose data URL decodes to `.../t/?table=N`.
- [ ] Step 2: MenuEditor provides a category list, item table with search, an edit Sheet (name, description, price, veg/egg, tags incl. "Bestseller", image picker from `public/images/menu`, options editor) and an availability switch.
- [ ] Step 3: TableQrCard is a branded card (logo, "Scan to order · Table N", QR built with `qrcode.toDataURL(location.origin + withBase('/t/?table=N'))`). Provide "Download PNG" per card (canvas → blob) and "Print all" (print CSS, A4 grid of 6). The owner can set the table count.
- [ ] Step 4: Tests pass. Commit `feat(staff): menu admin and printable table QR codes`.

### Task 12: CRM, loyalty, and coupons

**Files:** `src/domain/segments.ts`, `src/app/staff/customers/page.tsx` (list + `?id=` profile), `src/app/staff/loyalty/page.tsx`, `src/components/staff/{CustomerTable,CustomerProfile,CouponEditor}.tsx`. Tests: `tests/unit/domain/segments.test.ts`, `tests/e2e/crm.spec.ts`

**Interfaces — Produces:** `export type Segment = "all_opted_in" | "new" | "regular" | "vip" | "inactive_30d"; export function tagsFor(s: {orders:number; totalSpend:number; lastOrderAt:string|null}, now: Date): CustomerStats["tags"]; export function inSegment(c: CustomerStats, seg: Segment, now: Date): boolean;`

Tag rules: new = 1 order; regular = ≥3 orders; vip = totalSpend ≥ ₹5,000 or ≥8 orders; inactive = last order >30 days ago. `all_opted_in` requires `marketingOptIn`, and every segment also requires opt-in.

- [ ] Step 1: Failing unit tests for each tag boundary (2 vs 3 orders, ₹4,999 vs ₹5,000, 30 vs 31 days), plus E2E: a customer who places an order appears at the top of the list sorted by last order. The profile shows that order and the loyalty ledger.
- [ ] Step 2: CustomerTable has search (name/phone), tag filter chips and sortable columns. It shows KPI tiles (total customers, repeat rate, avg spend, opted-in %).
- [ ] Step 3: CustomerProfile shows a header with name, masked phone with reveal, tags, a stats grid, favourites, an order history table, the loyalty ledger and a notes textarea (saves on blur). Quick actions: WhatsApp the customer (wa.me) and call.
- [ ] Step 4: The loyalty page has a rules editor (owner) and CouponEditor (create/edit, active switch, usage stats).
- [ ] Step 5: Tests pass. Commit `feat(crm): customers, loyalty and coupons`.

### Task 13: Campaigns, reports, settings

**Files:** `src/domain/reports.ts`, `src/app/staff/{campaigns,reports,settings}/page.tsx`, `src/components/staff/{CampaignComposer,PhonePreview,ReportCharts}.tsx`. Tests: `tests/unit/domain/reports.test.ts`, `tests/e2e/reports.spec.ts`

**Interfaces — Produces:** `export function summarize(orders: Order[], range: {from: Date; to: Date}): { revenue: number; orders: number; aov: number; byHour: {hour:number; orders:number; revenue:number}[]; byDay: {date:string; revenue:number; orders:number}[]; topItems: {name:string; qty:number; revenue:number}[]; byMode: Record<OrderMode, number>; byPayment: { online:number; cash:number; split:number }; couponDiscount: number; loyaltyDiscount: number }; export function toCsv(orders: Order[]): string;` Only completed and paid orders count toward revenue.

- [ ] Step 1: Failing unit tests on a hand-built 5-order fixture covering revenue excluding rejected orders, split classification, byHour bucketing in local time, and CSV header + escaping of commas/quotes.
- [ ] Step 2: Reports page: range presets (Today, 7d, 30d, custom), KPI tiles with delta vs the previous period, revenue line (recharts), orders-by-hour bars, top items table, mode/payment donuts with legends and accessible labels, and an "Export CSV" button (Blob download).
- [ ] Step 3: Campaigns page: a segment select with live recipient count, template picker (Tiramisu Fest is back, Mango Mania, We miss you — 15% off with WINBACK15, New menu), editable body with `{name}` variable, PhonePreview, and Send. Send shows an in-app confirm dialog, then a success toast "Queued to N customers (demo, no messages sent)". History table below.
- [ ] Step 4: Settings page: café details, hours per day, GST %, accepting orders switch (when off, `/order` shows "Not accepting online orders right now", with call/WhatsApp), slot length, social and delivery links, and table count.
- [ ] Step 5: E2E: Reports "Today" revenue increases after completing a new paid order; CSV download has rows. Tests pass. Commit `feat(staff): campaigns, reports, settings`.

### Task 14: Polish, accessibility, performance pass

- [ ] Step 1: Run the ui-ux-pro-max pre-delivery checklist on every page at 375/768/1024/1440. Use Playwright screenshots into `test-results/screens/` and look at them.
- [ ] Step 2: Add `@axe-core/playwright` scans on home, order, checkout, track and staff orders. Fix all serious/critical violations.
- [ ] Step 3: Add metadata, OG image (real hero photo), favicon from the logo, `robots` noindex (it's a demo), and a 404 page.
- [ ] Step 4: Run Lighthouse on the home page from the static build (`npx lighthouse http://localhost:4173 --preset=desktop` and mobile). Target Perf ≥ 85 and A11y ≥ 95. Fix image sizes, fonts and CLS.
- [ ] Step 5: Run the full `npm test && npm run build && npx playwright test`. Expected: all green. Commit `chore: polish, a11y and performance`.

### Task 15: Deploy to GitHub Pages

- [ ] Step 1: Add `.github/workflows/pages.yml`: on push to main, Node 24, `npm ci`, `npm test`, build with `NEXT_PUBLIC_BASE_PATH=/gluttons-garage` and the optional Supabase/Razorpay vars from repo variables, `touch out/.nojekyll`, `actions/upload-pages-artifact`, `actions/deploy-pages`.
- [ ] Step 2: **Ask the user to confirm** before creating the public repo. Then run `gh repo create gluttons-garage --public --source . --push`, enable Pages (Actions source) with `gh api -X POST repos/{owner}/gluttons-garage/pages -f build_type=workflow`, and watch the run with `gh run watch`.
- [ ] Step 3: Verify the live URL: home loads, `/t/?table=3` works, and assets resolve under the base path. Write `docs/DEMO_SCRIPT.md`, a 5-minute pitch walkthrough: phone scans the table QR, laptop shows the kitchen board, payment, tracking, CRM, reports.

### Task 16: Final review

- [ ] Step 1: Dispatch the code-reviewer agent (whole repo vs. spec and plan) and the security-auditor agent (RLS, SQL functions, XSS in notes/campaign bodies, payment flow, no secrets). Fix confirmed findings with tests.
- [ ] Step 2: Re-run the full test suite and redeploy. Report the results with evidence (test output, live URL, screenshots).
