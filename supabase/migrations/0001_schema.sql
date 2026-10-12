-- Gluttons Garage demo: schema (spec §3). Money is whole rupees (integer).
-- Run order: 0001_schema.sql, 0002_functions.sql, 0003_rls.sql, then seed.sql.

-- ---- settings & menu ------------------------------------------------------

create table public.settings (
  id boolean primary key default true check (id),
  cafe_name text not null,
  phone text not null,
  whatsapp text not null,
  gst_percent integer not null default 5,
  accepting_orders boolean not null default true,
  slot_minutes integer not null default 15,
  tables integer not null default 10,
  socials jsonb not null,
  delivery jsonb not null,
  hours jsonb not null,
  loyalty jsonb not null
);

create table public.menu_categories (
  id text primary key,
  name text not null,
  sort integer not null default 0
);

create table public.menu_items (
  id text primary key,
  category_id text not null references public.menu_categories (id),
  name text not null,
  description text,
  price integer not null check (price >= 0),
  image_url text,
  is_veg boolean,
  is_egg boolean,
  tags text[] not null default '{}',
  is_available boolean not null default true,
  nutrition jsonb,
  sort integer not null default 0
);

create table public.item_options (
  id text primary key,
  item_id text not null references public.menu_items (id) on delete cascade,
  group_name text not null,
  label text not null,
  price_delta integer not null default 0,
  sort integer not null default 0
);
create index item_options_item_idx on public.item_options (item_id);

create table public.tables (
  number integer primary key check (number > 0),
  label text not null,
  active boolean not null default true
);

-- ---- customers & orders ---------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^[0-9]{10}$'),
  name text not null,
  marketing_opt_in boolean not null default false,
  notes text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.coupons (
  code text primary key check (code = upper(code) and code <> ''),
  type text not null check (type in ('percent', 'flat')),
  value integer not null check (value >= 0),
  min_order integer not null default 0,
  max_discount integer,
  expires_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  first_order_only boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence public.order_code_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  short_code text not null unique,
  customer_id uuid not null references public.customers (id),
  customer_name text not null,
  phone text not null,
  mode text not null check (mode in ('dine_in', 'takeaway')),
  table_number integer,
  pickup_time text,
  status text not null default 'placed'
    check (status in ('placed', 'accepted', 'preparing', 'ready', 'completed', 'rejected', 'cancelled')),
  subtotal integer not null,
  discount integer not null default 0,
  loyalty_discount integer not null default 0,
  points_redeemed integer not null default 0,
  taxable integer not null,
  cgst integer not null,
  sgst integer not null,
  tax integer generated always as (cgst + sgst) stored,
  total integer not null check (total >= 0),
  online_due integer not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  coupon_code text references public.coupons (code) on update cascade on delete set null,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seq bigint generated always as identity
);
create index orders_created_idx on public.orders (created_at desc, seq desc);
create index orders_customer_idx on public.orders (customer_id);

create table public.order_items (
  order_id uuid not null references public.orders (id) on delete cascade,
  line_no integer not null,
  item_id text not null,
  name_snapshot text not null,
  unit_price integer not null,
  options jsonb not null default '[]', -- [{id, label}]
  qty integer not null check (qty between 1 and 50),
  note text,
  line_total integer not null,
  primary key (order_id, line_no)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method text not null check (method in ('online', 'cash')),
  channel text not null,
  amount integer not null check (amount >= 0),
  status text not null check (status in ('pending', 'success', 'failed')),
  reference text,
  created_at timestamptz not null default now(),
  recorded_by uuid,
  seq bigint generated always as identity
);
create index payments_order_idx on public.payments (order_id, seq);

create table public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  points integer not null,
  reason text not null check (reason in ('earn', 'redeem', 'adjust')),
  created_at timestamptz not null default now(),
  seq bigint generated always as identity
);
create index loyalty_ledger_customer_idx on public.loyalty_ledger (customer_id);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text not null check (segment in ('all_opted_in', 'new', 'regular', 'vip', 'inactive_30d')),
  template text not null,
  sent_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.message_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete cascade,
  to_phone text not null,
  direction text not null check (direction in ('to_customer', 'to_cafe')),
  body text not null,
  created_at timestamptz not null default now(),
  seq bigint generated always as identity
);
create index message_log_order_idx on public.message_log (order_id);

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role text not null check (role in ('owner', 'kitchen'))
);

-- ---- customer aggregates ----------------------------------------------------
-- security_invoker: callers only see what RLS lets them see (staff only).

create view public.customer_stats with (security_invoker = true) as
with live as (
  select o.* from public.orders o where o.status not in ('rejected', 'cancelled')
), agg as (
  select c.id,
         count(l.id)::int as orders,
         coalesce(sum(l.total), 0)::int as total_spend,
         max(l.created_at) as last_order_at
    from public.customers c left join live l on l.customer_id = c.id
   group by c.id
)
select c.id, c.phone, c.name, c.marketing_opt_in, c.notes, c.created_at,
       a.orders, a.total_spend, a.last_order_at,
       case when a.orders > 0 then round(a.total_spend::numeric / a.orders)::int else 0 end as avg_bill,
       coalesce((
         select array_agg(f.name order by f.qty desc, f.name)
           from (select i.name_snapshot as name, sum(i.qty) as qty
                   from live l join public.order_items i on i.order_id = l.id
                  where l.customer_id = c.id
                  group by i.name_snapshot
                  order by sum(i.qty) desc, i.name_snapshot
                  limit 3) f
       ), '{}') as favourites,
       coalesce((select sum(points) from public.loyalty_ledger g where g.customer_id = c.id), 0)::int as points,
       array_remove(array[
         -- mirrors domain/segments.ts tagsFor: inactive takes precedence over new
         case when a.orders = 1 and not (a.last_order_at < now() - interval '30 days') then 'new' end,
         case when a.orders >= 3 then 'regular' end,
         case when a.total_spend >= 5000 or a.orders >= 8 then 'vip' end,
         case when a.last_order_at < now() - interval '30 days' then 'inactive' end
       ], null) as tags
  from public.customers c join agg a on a.id = c.id;

-- ---- seed snapshot (reset_demo copies these, shifted to now()) ------------

create table public.seed_meta (
  id boolean primary key default true check (id),
  anchor timestamptz not null,
  next_code integer not null
);
create table public.seed_settings as table public.settings with no data;
create table public.seed_menu_categories as table public.menu_categories with no data;
create table public.seed_menu_items as table public.menu_items with no data;
create table public.seed_item_options as table public.item_options with no data;
create table public.seed_tables as table public.tables with no data;
create table public.seed_customers as table public.customers with no data;
create table public.seed_coupons as table public.coupons with no data;
create table public.seed_orders as table public.orders with no data;
create table public.seed_order_items as table public.order_items with no data;
create table public.seed_payments as table public.payments with no data;
create table public.seed_loyalty_ledger as table public.loyalty_ledger with no data;

-- ---- realtime ---------------------------------------------------------------

alter publication supabase_realtime add table public.orders, public.message_log, public.menu_items;
