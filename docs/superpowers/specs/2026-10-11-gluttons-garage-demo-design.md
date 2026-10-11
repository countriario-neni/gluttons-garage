# Gluttons Garage — Ordering, Payments & CRM Demo — Design Spec

**Date:** 2026-10-11
**Status:** Draft — awaiting review
**Client:** Gluttons Garage, Visakhapatnam — fusion food café (specialty coffee, cool beverages, desserts). Instagram: @gluttons_garage (~2.9k followers).

## 1. Purpose

Build a **pitch demo**: a fully working, clickable website the client can use end-to-end (order from a phone at a table, see it arrive live on the kitchen dashboard, pay, settle cash, see the customer in the CRM and the sale in reports). It is hosted on GitHub Pages. If the client signs, the same codebase moves to Vercel and the demo integrations are replaced by live ones.

**Success criteria**
- A person scans a table QR on their phone, orders, pays (online / cash / split) and the order appears on a laptop dashboard within ~2 s with a sound alert.
- Every feature listed in §4–§5 is clickable and behaves believably with seeded data.
- Real-world links (WhatsApp widget, click-to-call, social links, Google Maps) work for real.
- No fabricated content is presented as genuine: sample reviews and seeded data are labelled as samples.
- Going live requires swapping adapters and configuration, not rewriting screens.

**Out of scope:** delivery (link out to Swiggy/Zomato instead), table reservations engine (the "Book a table" CTA opens WhatsApp/call), POS hardware, printing to thermal printers, multi-branch, native apps.

## 2. Architecture

```
GitHub Pages (static)
└── Next.js (App Router, `output: 'export'`) + TypeScript + Tailwind + shadcn/ui
     ├── Public site      /                    home, menu, reviews, socials, location
     ├── Ordering         /order               mode select → menu → cart → checkout
     │                    /t?table=N           QR landing; dine-in at table N
     ├── Tracking         /track?id=…          live order status
     └── Staff            /staff/*             login, orders, menu, tables, CRM,
                                               loyalty & coupons, campaigns, reports, settings
          │  supabase-js (browser) + Realtime
          ▼
Supabase (free tier): Postgres + Auth (staff) + Realtime + RLS + SQL functions
```

- Static export cannot use dynamic route segments without pre-generation, so variable IDs use query params (`/track?id=`, `/t?table=`).
- `basePath` is configured for the GitHub Pages repo path.
- Supabase URL and anon key are public build-time env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

### Integration adapters

Each external integration is an interface in `src/integrations/<name>/` with a `demo` and (later) `live` implementation, selected by config.

| Adapter | Demo implementation | Live implementation (post-sign) |
|---|---|---|
| `payments` | Razorpay-styled mock modal (UPI / card / netbanking; success or failure). If `NEXT_PUBLIC_RAZORPAY_TEST_KEY` is set, uses real Razorpay Checkout in test mode instead. | Razorpay Orders API + signature-verified webhook (Vercel route) |
| `whatsapp` | Writes messages to a `message_log` table; UI shows them in a phone mockup | WhatsApp Cloud API template messages |
| `reviews` | Static JSON: labelled sample reviews, or real reviews supplied by us | Google Places API (Place Details reviews) |
| `instagram` | Static image grid linking to the profile | Instagram Graph API |

Real in the demo: floating WhatsApp widget (`wa.me` link), "Send order on WhatsApp" pre-filled message, `tel:` click-to-call, Instagram/Facebook/WhatsApp links, Google Maps embed, Swiggy/Zomato links.

## 3. Data model (Supabase / Postgres)

- `settings` (single row): café name, phone, WhatsApp number, address, hours, GST %, accepting_orders, takeaway slot length, loyalty rules (earn rate, redeem rate, min redeem).
- `menu_categories` (id, name, sort).
- `menu_items` (id, category_id, name, description, price, image_url, is_veg, tags[], is_available, sort).
- `item_options` (id, item_id, group_name, label, price_delta) — e.g. Size: Regular/Large; Add-on: Extra shot.
- `tables` (id, number, label, active).
- `customers` (id, phone unique, name, marketing_opt_in, notes, tags[], created_at). Aggregates (total spend, visits, last visit, favourite items) via a view `customer_stats`.
- `orders` (id, short_code, customer_id, mode `dine_in|takeaway`, table_number, pickup_time, status `placed|accepted|preparing|ready|completed|rejected|cancelled`, subtotal, discount, loyalty_discount, tax, total, payment_status `unpaid|partial|paid`, coupon_id, created_at, updated_at).
- `order_items` (order_id, item_id, name_snapshot, unit_price, options jsonb, qty, note, line_total).
- `payments` (id, order_id, method `online|cash`, amount, status `pending|success|failed`, reference, created_at, recorded_by). One order may have multiple rows (split).
- `coupons` (code, type `percent|flat`, value, min_order, max_discount, expires_at, usage_limit, used_count, first_order_only, active).
- `loyalty_ledger` (customer_id, order_id, points (+earn / −redeem), reason, created_at). Balance = sum.
- `campaigns` (id, name, segment, template, sent_count, created_at).
- `message_log` (id, order_id?, campaign_id?, to_phone, direction `to_customer|to_cafe`, body, created_at).
- `staff` (user_id → auth.users, name, role `owner|kitchen`).

### Order placement — `place_order()` SQL function (security definer)

Input: customer name/phone/opt-in, mode, table/pickup time, items (item_id, option ids, qty, note), coupon code, points to redeem, payment plan (`online|cash|split` + online amount).
It: upserts the customer by phone; **recomputes all prices from `menu_items`/`item_options`**; rejects unavailable items or when `accepting_orders` is false; validates coupon and loyalty redemption; computes tax and total; inserts order, items and pending payment rows; writes the "order received" messages to `message_log`; returns order id + short code + amount due online. Client-sent prices are never trusted.

Companion functions: `confirm_online_payment(order_id, ref, success)` (demo stand-in for the webhook), `record_cash_payment(order_id, amount)` (staff only), `update_order_status(order_id, status)` (staff only; appends status messages to `message_log`; awards loyalty points on `completed`), `get_order_public(order_id)` (returns a tracking-safe subset).

### Row-level security

- Anonymous: `select` on menu, categories, options, tables, public settings fields; no direct writes — only via `place_order`, `confirm_online_payment`, `get_order_public`.
- Staff (`authenticated` with a `staff` row): full access. Kitchen role cannot edit settings, coupons or campaigns.
- Order IDs are UUIDs; tracking requires the UUID.
- Demo DB contains only seeded/sample data.

## 4. Customer experience

### Public site
- Brand look derived from their Instagram: warm café palette, playful fusion vibe, food-first imagery.
- Hero with **Order now**, **Book a table** (WhatsApp/call), **Call** and **WhatsApp** buttons.
- Menu preview by category (Fusion Food, Speciality Coffee, Cool Beverages, Desserts), veg/non-veg markers, bestseller tags. Seed menu uses items in their style (e.g. Tiramisu Latte, Mango Mania specials) marked as sample.
- Highlights: Tiramisu Fest, Mango Mania, Events at GG.
- Reviews section: average rating, carousel, "Review us on Google" link. Labelled "Sample reviews" unless real ones are supplied.
- Instagram grid + Instagram / Facebook / WhatsApp links.
- Location: Google Maps embed (from their maps link), hours, click-to-call.
- Floating WhatsApp button on every public page with pre-filled greeting.
- Swiggy / Zomato "Order for delivery" buttons (links configurable; hidden if not set).

### Ordering flow
1. Entry: `/t?table=N` sets dine-in at table N; `/order` asks dine-in (enter table) or takeaway (choose pickup slot from today's remaining slots within hours).
2. Menu with search, category tabs, veg filter. Item sheet for options, per-item note, qty. Sold-out items shown disabled.
3. Cart persisted in `localStorage`; editable; sticky cart bar on mobile.
4. Checkout: name, phone (10-digit Indian mobile validation), marketing opt-in checkbox, coupon field, loyalty balance lookup by phone with "redeem" toggle, bill (subtotal, discount, loyalty, GST, total).
5. Payment choice:
   - **Pay online** — all modes.
   - **Pay at counter (cash)** — dine-in only.
   - **Split** — dine-in only; customer enters online portion; remainder due in cash.
6. Online portion goes through the `payments` adapter; on failure the customer can retry or switch to cash (dine-in).
7. Confirmation `/track?id=…`: order code, live status stepper via Realtime, payment summary, "WhatsApp messages you'd receive" phone preview (from `message_log`), and a working "Send order on WhatsApp" button.

## 5. Staff area

Login with Supabase Auth (demo credentials documented in README; two accounts: owner, kitchen).

- **Orders (kitchen board):** columns New / Preparing / Ready (+ Completed today list). Realtime insert → chime + highlight. Card: code, table or "Takeaway · 6:30 PM", items, options, notes, payment badge (Paid / Partial ₹x due / Cash due). Actions: Accept, Reject, Preparing, Ready, Complete; **Settle cash** dialog (amount received, change due). Sound toggle (browsers require one user interaction before audio).
- **Menu:** CRUD categories and items, options, image URL, availability toggle.
- **Tables & QR:** set tables; generate QR per table pointing to `/t?table=N`; download PNG per table and a printable sheet of all.
- **Customers (CRM):** searchable list with tags (New, Regular, VIP, Inactive 30d — derived rules), profile with history, total spend, visits, average bill, favourites, loyalty balance and ledger, notes.
- **Loyalty & coupons:** edit earn/redeem rules; coupon CRUD with usage stats.
- **Campaigns:** choose segment (all opted-in, new, regular, VIP, inactive 30d), choose/edit template, phone-mockup preview, recipient count, "Send" → writes campaign + `message_log` rows (demo). Only opted-in customers included.
- **Reports:** date range; revenue, orders, AOV; orders by hour; top items; dine-in vs takeaway; online vs cash vs split; coupon and loyalty redemption totals. CSV export.
- **Settings:** café details, hours, GST %, accepting orders toggle, slot length, social and delivery links.
- **Reset demo** (owner only): calls `reset_demo()` which truncates transactional tables and re-runs the seed.

## 6. Seed data

~25 sample menu items across 4 categories with options; 10 tables; ~40 customers (fake names, `9xxxxxxxxx`-style numbers clearly fake); ~3 weeks of orders with realistic hour/day distribution and mixed payment methods; 3 coupons (`WELCOME10`, `TIRAMISU50`, `GG100` expired); loyalty ledger consistent with orders.

## 7. Error handling

- Supabase unreachable → banner "Ordering temporarily unavailable — call or WhatsApp us" with working links.
- `place_order` validation errors (sold out, coupon invalid, ordering paused) shown inline at checkout; cart preserved.
- Payment failure → retry or switch to cash (dine-in).
- Realtime disconnect on staff board → reconnect indicator + periodic refetch fallback (every 15 s).

## 8. Testing & verification

- **Unit (Vitest):** cart maths, option pricing, coupon rules, loyalty earn/redeem, split remainder, slot generation, phone validation.
- **Database:** SQL tests (run via Supabase CLI or a node script) for `place_order` price recomputation, coupon limits, RLS denial of anonymous writes.
- **E2E (Playwright)** against a local build + the Supabase project:
  1. QR dine-in → pay online → staff accepts → ready → completed → loyalty awarded.
  2. Takeaway → pay online → appears with pickup time.
  3. Dine-in split → staff settles cash → order paid.
  4. Two browser contexts: order in one appears on the board in the other within 5 s.
- Responsive check at 375 px and tablet widths; Lighthouse pass on the public home page.
- Final review by code-reviewer and security-auditor agents.

## 9. Deployment

- GitHub repo (default name `gluttons-garage`, public, under the user's account) → GitHub Actions builds the static export and deploys to GitHub Pages. Supabase env vars stored as repository variables.
- Supabase migrations and seed in `supabase/` and applied via the Supabase CLI or SQL editor.
- Go-live (separate future work): Vercel deployment, custom domain, live adapters, Razorpay webhook route, WhatsApp Cloud API templates approved by Meta, Google Places key.

## 10. Inputs needed

- **Required for the build:** a Supabase project (URL + anon key; service access to run migrations), a GitHub repo/account with `gh` authenticated.
- **Optional, improves realism:** café phone/WhatsApp number, Facebook page URL, Swiggy/Zomato links, real menu and prices, photos, a few real Google reviews, Razorpay test key.
- **Client-side for go-live:** Razorpay merchant KYC, Meta Business verification + WhatsApp number, Google Business Profile access, domain, GSTIN/FSSAI.
