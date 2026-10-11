# Supabase setup

Without Supabase the site runs on `LocalStore` (localStorage, one browser). With it, orders, the kitchen board and the
CRM are shared across devices. The site is a static export, so the browser talks to Supabase directly with the
**anon key**. All security lives in the database: row-level security plus `security definer` functions
(`supabase/migrations/0003_rls.sql` is the boundary).

## 1. Create the project

1. In [supabase.com](https://supabase.com), create a new project. Choose the **Mumbai (ap-south-1)** region and a strong
   database password, which you'll keep in your password manager.
2. Wait for it to finish provisioning.

## 2. Create the schema and the demo data

In **SQL Editor**, open a new query for each file below, paste the whole file, and click **Run**. Run them in this order:

1. `supabase/migrations/0001_schema.sql` creates the tables, the `customer_stats` view and the seed snapshot tables, and
   adds `orders`, `message_log` and `menu_items` to the `supabase_realtime` publication.
2. `supabase/migrations/0002_functions.sql` adds `place_order`, the payment and status functions and the WhatsApp message templates.
3. `supabase/migrations/0003_rls.sql` turns on RLS, adds the policies and sets the grants.
4. `supabase/seed.sql` loads the menu, settings, 40 sample customers and about 500 orders. History is moved forward by
   whole days, so orders keep their time of day, and anything that would land in the future is skipped. The three
   in-flight orders on the kitchen board are always a few minutes old. "Reset demo" (owner) does the same again.

`seed.sql` is generated. If `src/data/seed.ts` or the menu changes, run `npm run db:seed` to regenerate it, then run it
again in the SQL editor. It's safe to re-run, and it resets the demo.

## 3. Create the staff logins

1. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Staff accounts are created by hand.
2. Go to **Authentication → Users → Add user → Create new user**. Create both users with **Auto Confirm User** ticked:
   - `owner@gluttonsgarage.demo`
   - `kitchen@gluttonsgarage.demo`

   Give each one a strong password of your own. Do **not** reuse the local demo password `garage123`, because these
   logins work on the live site.
3. In the SQL editor, link the two users to their roles:

   ```sql
   insert into public.staff (user_id, name, role)
   select id, 'Owner', 'owner' from auth.users where email = 'owner@gluttonsgarage.demo'
   union all
   select id, 'Kitchen', 'kitchen' from auth.users where email = 'kitchen@gluttonsgarage.demo';
   ```

The owner can do everything. The kitchen role can run the order board (status changes, cash, availability, customer
notes) but gets `FORBIDDEN` on settings, coupons, campaigns, menu edits and demo reset.

## 4. Realtime

There's nothing to do here. `0001_schema.sql` already added `orders`, `message_log` and `menu_items` to the
`supabase_realtime` publication. Staff screens listen to those tables. Customers can't read `orders` under RLS, so the
tracking page polls `get_order_public` every 3 seconds instead.

## 5. Connect the site

1. In **Project Settings → API**, copy the **Project URL** and the **anon public** key. Never use the `service_role` key in the site.
2. In the GitHub repo, go to **Settings → Secrets and variables → Actions → Variables** and add two repository variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Re-run the Pages deploy. When both variables are set at build time, `createStore()` uses `SupabaseStore`.
   Otherwise it falls back to `LocalStore`.

For local development, put the same two values in `.env.local` (it's git-ignored).

## 6. Check it

- Open the site in two browsers, place an order in one and watch it appear on the kitchen board in the other.
- Sign in as kitchen, and check that opening Settings or sending a campaign fails with "not allowed".
- In the SQL editor, `select * from public.orders` works (you are `postgres`). Through the API with the anon key,
  `/rest/v1/orders` returns a permission error.

## Before going live

The schema is built for a public demo with sample data. Before real customers use it:

- [ ] **A phone number is enough to act as that customer.** Anyone who knows a customer's number can call `place_order`
      with it. That overwrites the customer's saved name and marketing opt-in, and spends their loyalty points on a new
      order. Add OTP or phone verification before redemption and profile updates go to production.
- [ ] **Loyalty lookup leaks first names.** `lookup_loyalty(phone)` is callable by anyone. It returns the first name and
      points balance for any phone number (LocalStore does the same). Consider requiring an OTP before showing the balance.
- [ ] **Payment confirmation is a stand-in.** `confirm_online_payment` is callable by anon so the demo checkout works.
      With a real gateway (Razorpay), revoke it from `anon` and call it only from the gateway webhook (an Edge Function
      using the service-role key) after verifying the signature.
- [ ] **Order UUIDs are capabilities.** Anyone with an order's UUID can see its tracking view (first name, items, total,
      status, customer messages, with no phone number). Don't log or share tracking links publicly.
- [ ] **Coupon codes can be guessed.** `validate_coupon` reveals whether a code exists. Use long codes for private offers.
- [ ] **Rate limiting.** `place_order` is open to anon. Put the API behind Supabase's rate limits or add a captcha (e.g. Turnstile) to checkout.
- [ ] **Sign-ups off.** Confirm "Allow new users to sign up" is off. A signed-in user without a `staff` row sees nothing, but there's no reason to allow it.
- [ ] **Remove the demo reset.** `reset_demo()` (owner only) wipes all orders and customers. Drop it, or revoke it, for a real café:
      `revoke execute on function public.reset_demo() from authenticated;`
- [ ] **Delete the seed data.** Truncate `orders`, `customers` and the related tables, and the `seed_*` tables, before going live.
- [ ] **Backups.** Enable point-in-time recovery or scheduled backups on a paid plan.
- [ ] **Rotate passwords.** Use unique staff passwords, and turn on MFA for the Supabase dashboard account.

## How it is tested

`npm test` runs the migrations and `seed.sql` in an in-process Postgres (PGlite) with a small Supabase shim
(`tests/sql/shim.sql`: roles `anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()`, default grants and the
realtime publication):

- `tests/sql/rls.test.ts` covers what anon, kitchen, owner and a non-staff user can read, write and execute.
- `tests/sql/functions.test.ts` mirrors the LocalStore behaviour tests (payments, status flow, loyalty, campaigns, reset).
- `tests/sql/parity.test.ts` runs `tests/parity/fixtures.json` through both `place_order` and LocalStore/`priceOrder`,
  and requires equal bills and equal error codes.

These tests don't cover Supabase's own services (PostgREST, Auth, Realtime). After setup, run the checks in step 6 once.
