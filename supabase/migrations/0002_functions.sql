-- Gluttons Garage demo: functions. All writes go through these; the browser holds only the anon key.
-- Behaviour mirrors src/store/local/LocalStore.ts and src/domain/* (pricing, coupons, loyalty).
-- Errors are raised as bare codes (e.g. 'BAD_AMOUNT') which SupabaseStore rethrows as Error(code).
-- Grants live in 0003_rls.sql. Underscore-prefixed functions are internal and executable by nobody.

-- =========================================================================
-- Generic helpers
-- =========================================================================

-- Timestamps are kept at millisecond precision so ISO strings round-trip exactly.
create function public._now() returns timestamptz
language sql stable set search_path = public, pg_temp
as $$ select date_trunc('milliseconds', now()) $$;

-- JS Date.prototype.toISOString()
create function public._iso(t timestamptz) returns text
language sql immutable set search_path = public, pg_temp
as $$ select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- JS Math.round for the non-negative float8 values used in pricing (ties go up).
create function public._js_round(x float8) returns integer
language sql immutable set search_path = public, pg_temp
as $$ select (floor(x) + case when x - floor(x) >= 0.5 then 1 else 0 end)::integer $$;

-- A JSON number that is an integer in int4 range (JS Number.isInteger), else null.
create function public._jint(j jsonb) returns integer
language plpgsql immutable set search_path = public, pg_temp
as $$
declare n numeric;
begin
  if jsonb_typeof(j) is distinct from 'number' then return null; end if;
  n := (j #>> '{}')::numeric;
  if n <> trunc(n) or n < -2147483648 or n > 2147483647 then return null; end if;
  return n::integer;
end $$;

-- A JSON string (or null), optionally capped at max_len characters (longer => null).
create function public._jstr(j jsonb, max_len integer default null) returns text
language sql immutable set search_path = public, pg_temp
as $$
  select case when jsonb_typeof(j) = 'string' and (max_len is null or char_length(j #>> '{}') <= max_len) then j #>> '{}' end
$$;

create function public._trim(t text) returns text
language sql immutable set search_path = public, pg_temp
as $$ select regexp_replace(t, '^\s+|\s+$', '', 'g') $$;

-- LocalStore normPhone: digits only, last 10.
create function public._norm_phone(p text) returns text
language sql immutable set search_path = public, pg_temp
as $$ select right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 10) $$;

-- domain/validation.ts isIndianMobile
create function public._is_indian_mobile(p text) returns boolean
language sql immutable set search_path = public, pg_temp
as $$
  select length(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g')) >= 10 and public._norm_phone(p) ~ '^[6-9][0-9]{9}$'
$$;

create function public._first_name(n text) returns text
language sql immutable set search_path = public, pg_temp
as $$ select nullif((regexp_split_to_array(public._trim(coalesce(n, '')), '\s+'))[1], '') $$;

create function public._fail(code text) returns jsonb
language sql immutable set search_path = public, pg_temp
as $$ select jsonb_build_object('ok', false, 'error', code) $$;

-- =========================================================================
-- Auth
-- =========================================================================

create function public._staff_role() returns text
language sql stable security definer set search_path = public, pg_temp
as $$ select role from public.staff where user_id = auth.uid() $$;

-- Used by RLS policies.
create function public.is_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.staff where user_id = auth.uid()) $$;

create function public._require_staff() returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare r text := public._staff_role();
begin
  if r is null then raise exception 'UNAUTHENTICATED'; end if;
  return r;
end $$;

create function public._require_owner() returns void
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if public._require_staff() <> 'owner' then raise exception 'FORBIDDEN'; end if;
end $$;

-- =========================================================================
-- Loyalty, coupons, pricing (mirror src/domain)
-- =========================================================================

create function public._points_balance(cid uuid) returns integer
language sql stable set search_path = public, pg_temp
as $$ select coalesce(sum(points), 0)::integer from public.loyalty_ledger where customer_id = cid $$;

-- No previous non-rejected order (db.ts isFirstOrder).
create function public._is_first_order(cid uuid) returns boolean
language sql stable set search_path = public, pg_temp
as $$ select cid is null or not exists (select 1 from public.orders where customer_id = cid and status <> 'rejected') $$;

create function public._coupon_json(c public.coupons) returns jsonb
language sql immutable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'code', c.code, 'type', c.type, 'value', c.value, 'minOrder', c.min_order, 'maxDiscount', c.max_discount,
    'expiresAt', public._iso(c.expires_at), 'usageLimit', c.usage_limit, 'usedCount', c.used_count,
    'firstOrderOnly', c.first_order_only, 'active', c.active)
$$;

-- domain/coupons.ts couponDiscount
create function public._coupon_discount(c public.coupons, subtotal integer, is_first boolean) returns jsonb
language plpgsql stable set search_path = public, pg_temp
as $$
declare amount integer;
begin
  if not c.active then return jsonb_build_object('ok', false, 'reason', 'INACTIVE'); end if;
  if c.expires_at is not null and c.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'EXPIRED'); end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then return jsonb_build_object('ok', false, 'reason', 'LIMIT'); end if;
  if c.first_order_only and not is_first then return jsonb_build_object('ok', false, 'reason', 'FIRST_ORDER_ONLY'); end if;
  if subtotal < c.min_order then return jsonb_build_object('ok', false, 'reason', 'MIN_ORDER'); end if;
  amount := case when c.type = 'percent' then public._js_round((subtotal::bigint * c.value)::float8 / 100) else c.value end;
  if c.max_discount is not null then amount := least(amount, c.max_discount); end if;
  return jsonb_build_object('ok', true, 'amount', greatest(0, least(amount, subtotal)));
end $$;

-- domain/pricing.ts priceOrder: prices only from menu_items/item_options; client prices are never read.
-- Returns {ok:true, bill} or {ok:false, error}. Loyalty and GST constants match domain/loyalty.ts and pricing.ts.
create function public._price_order(p_lines jsonb, p_coupon public.coupons, p_first boolean, p_points integer, p_balance integer)
returns jsonb
language plpgsql stable set search_path = public, pg_temp
as $$
declare
  l jsonb;
  oid jsonb;
  item public.menu_items;
  opt public.item_options;
  qty integer;
  seen text[];
  groups text[];
  delta integer;
  labels jsonb;
  unit integer;
  priced jsonb := '[]';
  subtotal integer := 0;
  cd jsonb;
  coupon_amt integer := 0;
  after_coupon integer;
  max_pts integer;
  blocks integer;
  loyalty_amt integer;
  taxable integer;
  tax integer;
  cgst integer;
begin
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    return public._fail('EMPTY_CART');
  end if;

  for l in select value from jsonb_array_elements(p_lines) loop
    qty := public._jint(l -> 'qty');
    if qty is null or qty < 1 or qty > 50 then return public._fail('BAD_QTY'); end if;

    select * into item from public.menu_items where id = public._jstr(l -> 'itemId');
    if not found or not item.is_available then return public._fail('ITEM_UNAVAILABLE'); end if;

    if jsonb_typeof(l -> 'optionIds') is distinct from 'array' then return public._fail('BAD_OPTION'); end if;
    seen := '{}';
    groups := '{}';
    delta := 0;
    labels := '[]';
    for oid in select value from jsonb_array_elements(l -> 'optionIds') loop
      select * into opt from public.item_options where id = public._jstr(oid) and item_id = item.id;
      if not found or opt.id = any (seen) then return public._fail('BAD_OPTION'); end if;
      seen := seen || opt.id;
      if opt.group_name in ('Dressing', 'Choice', 'Size') then
        if opt.group_name = any (groups) then return public._fail('BAD_OPTION'); end if;
        groups := groups || opt.group_name;
      end if;
      delta := delta + opt.price_delta;
      labels := labels || to_jsonb(opt.label);
    end loop;

    if l ? 'note' and jsonb_typeof(l -> 'note') <> 'null' and public._jstr(l -> 'note', 200) is null then
      return public._fail('BAD_NOTE');
    end if;

    unit := item.price + delta;
    priced := priced || jsonb_build_array(
      jsonb_build_object('itemId', item.id, 'optionIds', l -> 'optionIds', 'qty', qty, 'name', item.name,
                         'unitPrice', unit, 'lineTotal', unit * qty, 'optionLabels', labels)
      || case when public._jstr(l -> 'note') is not null then jsonb_build_object('note', l -> 'note') else '{}' end);
    subtotal := subtotal + unit * qty;
  end loop;

  if p_coupon.code is not null then
    cd := public._coupon_discount(p_coupon, subtotal, p_first);
    if (cd ->> 'ok')::boolean then coupon_amt := (cd ->> 'amount')::integer; end if;
  end if;
  after_coupon := subtotal - coupon_amt;

  -- loyalty.ts maxRedeemablePoints: 100-point blocks, worth 50 each, at most 50% of (subtotal - coupon).
  max_pts := greatest(0, least(floor(p_balance::numeric / 100), floor(floor(after_coupon::numeric * 0.5) / 50)))::integer * 100;
  blocks := floor(least(greatest(0, p_points), max_pts)::numeric / 100)::integer;
  loyalty_amt := blocks * 50;

  taxable := after_coupon - loyalty_amt;
  tax := public._js_round(taxable::float8 * 0.05::float8);
  cgst := floor(tax / 2.0)::integer;

  return jsonb_build_object('ok', true, 'bill', jsonb_build_object(
    'lines', priced, 'subtotal', subtotal, 'couponDiscount', coupon_amt, 'loyaltyDiscount', loyalty_amt,
    'pointsRedeemed', blocks * 100, 'taxable', taxable, 'cgst', cgst, 'sgst', tax - cgst, 'total', taxable + tax));
end $$;

-- =========================================================================
-- Order JSON (the DataStore Order shape)
-- =========================================================================

create function public._order_json(p_id uuid) returns jsonb
language sql stable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', o.id,
    'code', o.short_code,
    'customerId', o.customer_id,
    'customerName', o.customer_name,
    'phone', o.phone,
    'mode', o.mode,
    'table', o.table_number,
    'pickupTime', o.pickup_time,
    'status', o.status,
    'bill', jsonb_build_object(
      'lines', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'itemId', i.item_id,
                   'optionIds', coalesce((select jsonb_agg(e -> 'id' order by n) from jsonb_array_elements(i.options) with ordinality x(e, n)), '[]'),
                   'qty', i.qty, 'name', i.name_snapshot, 'unitPrice', i.unit_price, 'lineTotal', i.line_total,
                   'optionLabels', coalesce((select jsonb_agg(e -> 'label' order by n) from jsonb_array_elements(i.options) with ordinality x(e, n)), '[]'))
                 || case when i.note is not null then jsonb_build_object('note', i.note) else '{}' end
                 order by i.line_no)
          from public.order_items i where i.order_id = o.id), '[]'),
      'subtotal', o.subtotal, 'couponDiscount', o.discount, 'loyaltyDiscount', o.loyalty_discount,
      'pointsRedeemed', o.points_redeemed, 'taxable', o.taxable, 'cgst', o.cgst, 'sgst', o.sgst, 'total', o.total),
    'couponCode', o.coupon_code,
    'paymentStatus', o.payment_status,
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'method', p.method, 'channel', p.channel, 'amount', p.amount,
                                          'status', p.status, 'reference', p.reference, 'createdAt', public._iso(p.created_at))
                       order by p.seq)
        from public.payments p where p.order_id = o.id), '[]'),
    'createdAt', public._iso(o.created_at),
    'updatedAt', public._iso(o.updated_at))
  from public.orders o where o.id = p_id
$$;

-- Tracking-safe subset: no phone, no customer id, first name only, no payment references,
-- and only the messages sent to the customer (the cafe copy contains the phone number).
create function public._order_public_json(p_id uuid) returns jsonb
language sql stable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', j -> 'id', 'code', j -> 'code', 'mode', j -> 'mode', 'table', j -> 'table', 'pickupTime', j -> 'pickupTime',
    'status', j -> 'status', 'bill', j -> 'bill', 'paymentStatus', j -> 'paymentStatus',
    'payments', coalesce((select jsonb_agg(p - 'reference' order by n) from jsonb_array_elements(j -> 'payments') with ordinality x(p, n)), '[]'),
    'customerName', public._first_name(j ->> 'customerName'),
    'createdAt', j -> 'createdAt', 'updatedAt', j -> 'updatedAt',
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'direction', m.direction, 'body', m.body, 'createdAt', public._iso(m.created_at))
                       order by m.created_at desc, m.seq desc)
        from public.message_log m where m.order_id = p_id and m.direction = 'to_customer'), '[]'))
  from (select public._order_json(p_id) as j) s
  where j is not null
$$;

-- Staff get the full order; everyone else (anon) only the tracking-safe subset.
create function public._order_for_caller(p_id uuid) returns jsonb
language sql stable set search_path = public, pg_temp
as $$ select case when public._staff_role() is not null then public._order_json(p_id) else public._order_public_json(p_id) end $$;

create function public._refresh_payment_status(p_id uuid) returns void
language sql set search_path = public, pg_temp
as $$
  update public.orders o
     set payment_status = case when s.paid >= o.total then 'paid' when s.paid > 0 then 'partial' else 'unpaid' end,
         updated_at = public._now()
    from (select coalesce(sum(amount) filter (where status = 'success'), 0) as paid from public.payments where order_id = p_id) s
   where o.id = p_id
$$;

create function public._log(p_order uuid, p_campaign uuid, p_to text, p_direction text, p_body text) returns void
language sql set search_path = public, pg_temp
as $$
  insert into public.message_log (order_id, campaign_id, to_phone, direction, body, created_at)
  values (p_order, p_campaign, p_to, p_direction, p_body, public._now())
$$;

-- =========================================================================
-- WhatsApp message templates (mirror src/integrations/whatsapp/templates.ts on the key fields)
-- =========================================================================

-- ₹1,23,456 (en-IN grouping)
create function public._fmt_inr(n integer) returns text
language plpgsql immutable set search_path = public, pg_temp
as $$
declare s text := abs(n)::text; head text;
begin
  if length(s) > 3 then
    head := left(s, length(s) - 3);
    s := regexp_replace(head, '([0-9])(?=([0-9]{2})+$)', '\1,', 'g') || ',' || right(s, 3);
  end if;
  return '₹' || case when n < 0 then '-' else '' end || s;
end $$;

-- "18:30" -> "6:30 PM"
create function public._time12(hhmm text) returns text
language sql immutable set search_path = public, pg_temp
as $$
  select case when split_part(hhmm, ':', 1)::int % 12 = 0 then 12 else split_part(hhmm, ':', 1)::int % 12 end
         || ':' || lpad(split_part(hhmm, ':', 2), 2, '0') || ' '
         || case when split_part(hhmm, ':', 1)::int < 12 then 'AM' else 'PM' end
$$;

create function public._msg_where(o jsonb) returns text
language sql immutable set search_path = public, pg_temp
as $$
  select case when o ->> 'mode' = 'dine_in' then 'Table ' || (o ->> 'table')
              else 'Pickup at ' || coalesce(public._time12(o ->> 'pickupTime'), 'your slot') end
$$;

create function public._msg_items(o jsonb) returns text
language sql immutable set search_path = public, pg_temp
as $$
  select string_agg(
           (l ->> 'qty') || '× ' || (l ->> 'name')
           || case when jsonb_array_length(l -> 'optionLabels') > 0
                   then ' (' || (select string_agg(x, ', ' order by n) from jsonb_array_elements_text(l -> 'optionLabels') with ordinality t(x, n)) || ')'
                   else '' end,
           E'\n' order by n)
    from jsonb_array_elements(o -> 'bill' -> 'lines') with ordinality t(l, n)
$$;

create function public._msg_payment_summary(o jsonb) returns text
language sql immutable set search_path = public, pg_temp
as $$
  with p as (select value as p from jsonb_array_elements(o -> 'payments')),
  s as (
    select coalesce(sum((p ->> 'amount')::int) filter (where p ->> 'method' = 'online' and p ->> 'status' <> 'failed'), 0)::int as online,
           coalesce(bool_and(p ->> 'status' = 'success') filter (where p ->> 'method' = 'online' and p ->> 'status' <> 'failed'), false) as online_paid,
           coalesce(sum((p ->> 'amount')::int) filter (where p ->> 'method' = 'cash' and p ->> 'status' = 'pending'), 0)::int as cash_due,
           coalesce(sum((p ->> 'amount')::int) filter (where p ->> 'method' = 'cash' and p ->> 'status' = 'success'), 0)::int as cash_paid
      from p)
  select case
    when cash_due > 0 and online > 0 then 'Split: ' || public._fmt_inr(online) || ' online (' || case when online_paid then 'paid' else 'pending' end || ') + ' || public._fmt_inr(cash_due) || ' cash due'
    when cash_due > 0 then 'Cash due ' || public._fmt_inr(cash_due)
    when online > 0 then case when online_paid then 'Paid online ' else 'Online payment pending ' end || public._fmt_inr(online)
    when cash_paid > 0 then 'Paid in cash ' || public._fmt_inr(cash_paid)
    else 'Payment pending' end
  from s
$$;

create function public._msg_hi(o jsonb) returns text
language sql immutable set search_path = public, pg_temp
as $$ select 'Hi ' || coalesce(public._first_name(o ->> 'customerName'), 'there') || ',' $$;

create function public._msg_track(o jsonb) returns text
language sql immutable set search_path = public, pg_temp
as $$ select '📍 Follow your order live on our website under *Track order* with code ' || (o ->> 'code') || '.' $$;

create function public._msg_order_received_customer(o jsonb) returns text
language sql stable set search_path = public, pg_temp
as $$
  select array_to_string(array[
    'Hi ' || coalesce(public._first_name(o ->> 'customerName'), 'there') || '! 👋 Thanks for choosing *' || (select cafe_name from public.settings) || '*.',
    'We''ve received your order *' || (o ->> 'code') || '*.',
    '',
    public._msg_items(o),
    '',
    '*Total: ' || public._fmt_inr((o -> 'bill' ->> 'total')::int) || '* (incl. GST)',
    '📌 ' || public._msg_where(o),
    '',
    public._msg_track(o),
    'We''ll message you the moment the kitchen accepts it. 🍳'], E'\n')
$$;

create function public._msg_order_received_cafe(o jsonb) returns text
language sql immutable set search_path = public, pg_temp
as $$
  select array_to_string(array[
    '🔔 *New order ' || (o ->> 'code') || '*',
    (o ->> 'customerName') || ' · ' || (o ->> 'phone'),
    '📌 ' || public._msg_where(o),
    '',
    public._msg_items(o),
    '',
    '*Total: ' || public._fmt_inr((o -> 'bill' ->> 'total')::int) || '*',
    '💳 ' || public._msg_payment_summary(o)], E'\n')
$$;

create function public._msg_status_update(o jsonb) returns text
language sql stable set search_path = public, pg_temp
as $$
  select case o ->> 'status'
    when 'accepted' then public._msg_hi(o) || ' good news! ✅ Your order *' || (o ->> 'code') || '* has been accepted. The kitchen will start on it shortly.' || E'\n\n' || public._msg_track(o)
    when 'preparing' then public._msg_hi(o) || ' your order *' || (o ->> 'code') || '* is now being prepared. 👨‍🍳 Fresh and hot, coming right up.'
    when 'ready' then case when o ->> 'mode' = 'dine_in'
      then public._msg_hi(o) || ' your order *' || (o ->> 'code') || '* is ready! 🍽️ It will be served at your table (' || public._msg_where(o) || ') in a moment.'
      else public._msg_hi(o) || ' your order *' || (o ->> 'code') || '* is ready for pickup at the counter! 🛍️ Please show this code when you arrive (' || public._msg_where(o) || ').' end
    when 'completed' then array_to_string(array[
      public._msg_hi(o) || ' thank you for dining with us! 💛 Order *' || (o ->> 'code') || '* is complete.',
      'You''ve earned *' || greatest(0, floor((o -> 'bill' ->> 'total')::numeric / 10))::int || ' points* on this order. 100 points = ₹50 off next time.',
      '',
      'Loved it? A quick Google review means the world to us: https://maps.app.goo.gl/WDJRMVKBnvjigCqMA ⭐'], E'\n')
    when 'rejected' then public._msg_hi(o) || ' we''re sorry, we couldn''t take your order *' || (o ->> 'code') || '* this time. 🙏 Any payment or points used will be returned. Please call us on ' || (select phone from public.settings) || ' and we''ll sort it out.'
    when 'cancelled' then public._msg_hi(o) || ' your order *' || (o ->> 'code') || '* has been cancelled. Any payment or points used will be returned. We''d love to serve you again soon! 🙏'
    else public._msg_hi(o) || ' we''ve received your order *' || (o ->> 'code') || '*.'
  end
$$;

create function public._msg_payment_received(o jsonb, amount integer) returns text
language sql immutable set search_path = public, pg_temp
as $$
  select public._msg_hi(o) || ' we''ve received your payment of *' || public._fmt_inr(amount) || '* for order *' || (o ->> 'code') || '*. ✅ Thank you!'
$$;

-- =========================================================================
-- Public (anon) functions
-- =========================================================================

-- LocalStore.placeOrder: same validation order and error codes, same idempotency.
create function public.place_order(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  s public.settings;
  v_key text;
  v_phone text;
  v_name text;
  v_mode text;
  v_table integer;
  v_pickup text;
  v_kind text;
  v_points integer;
  v_lines jsonb;
  v_code text;
  v_split integer;
  v_online integer;
  v_cash integer;
  v_first boolean;
  v_balance integer := 0;
  v_now timestamptz := public._now();
  cust public.customers;
  cpn public.coupons;
  prior public.orders;
  r jsonb;
  bill jsonb;
  v_order uuid;
  o jsonb;
begin
  if jsonb_typeof(payload) is distinct from 'object' then return public._fail('BAD_REQUEST'); end if;
  v_key := public._jstr(payload -> 'idempotencyKey', 100);
  if v_key is null or v_key = '' then return public._fail('BAD_REQUEST'); end if;

  -- Idempotency: a double tap returns the order the first call created.
  perform pg_advisory_xact_lock(hashtext('place_order:' || v_key));
  select * into prior from public.orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'order', public._order_json(prior.id), 'onlineDue', prior.online_due);
  end if;

  select * into s from public.settings;
  if not coalesce(s.accepting_orders, false) then return public._fail('NOT_ACCEPTING'); end if;

  v_phone := public._jstr(payload -> 'phone', 32);
  if v_phone is null or not public._is_indian_mobile(v_phone) then return public._fail('BAD_PHONE'); end if;
  v_phone := public._norm_phone(v_phone);

  v_name := public._trim(public._jstr(payload -> 'name', 200));
  if v_name is null or v_name = '' or char_length(v_name) > 60 then return public._fail('BAD_NAME'); end if;

  v_mode := public._jstr(payload -> 'mode');
  if v_mode is null or v_mode not in ('dine_in', 'takeaway') then return public._fail('BAD_MODE'); end if;
  if v_mode = 'dine_in' then
    v_table := public._jint(payload -> 'table');
    if v_table is null or v_table < 1 or v_table > s.tables then return public._fail('BAD_TABLE'); end if;
  end if;
  if v_mode = 'takeaway' then
    v_pickup := public._jstr(payload -> 'pickupTime', 5);
    if v_pickup is null or v_pickup !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return public._fail('BAD_PICKUP'); end if;
  end if;

  v_kind := public._jstr(payload -> 'plan' -> 'kind');
  if v_mode = 'takeaway' and v_kind is distinct from 'online' then return public._fail('CASH_DINE_IN_ONLY'); end if;
  if v_kind is null or v_kind not in ('online', 'cash', 'split') then return public._fail('BAD_PLAN'); end if;

  -- Serialise orders per phone so a balance can't be redeemed twice concurrently.
  perform pg_advisory_xact_lock(hashtext('customer:' || v_phone));
  select * into cust from public.customers where phone = v_phone;
  if found then v_balance := public._points_balance(cust.id); end if;
  v_first := public._is_first_order(cust.id);

  v_points := public._jint(payload -> 'pointsToRedeem');
  if v_points is null or v_points < 0 or v_points % coalesce((s.loyalty ->> 'redeemBlock')::int, 100) <> 0 or v_points > v_balance then
    return public._fail('BAD_POINTS');
  end if;

  v_lines := payload -> 'lines';
  if jsonb_typeof(v_lines) is distinct from 'array' then return public._fail('BAD_REQUEST'); end if;
  if jsonb_array_length(v_lines) > 50 then return public._fail('TOO_MANY_LINES'); end if;

  r := public._price_order(v_lines, null, v_first, 0, v_balance);
  if not (r ->> 'ok')::boolean then return r; end if;

  v_code := public._trim(public._jstr(payload -> 'couponCode', 64));
  if v_code is not null and v_code <> '' then
    select * into cpn from public.coupons where code = upper(v_code) for update;
    if not found then return public._fail('COUPON_NOT_FOUND'); end if;
    r := public._coupon_discount(cpn, (r -> 'bill' ->> 'subtotal')::int, v_first);
    if not (r ->> 'ok')::boolean then return public._fail('COUPON_' || (r ->> 'reason')); end if;
  end if;

  r := public._price_order(v_lines, cpn, v_first, v_points, v_balance);
  if not (r ->> 'ok')::boolean then return r; end if;
  bill := r -> 'bill';

  v_online := (bill ->> 'total')::int;
  v_cash := 0;
  if v_kind = 'cash' then
    v_cash := v_online;
    v_online := 0;
  elsif v_kind = 'split' then
    v_split := public._jint(payload -> 'plan' -> 'onlineAmount');
    if v_split is null or v_split < 1 or v_split > (bill ->> 'total')::int - 1 then return public._fail('BAD_SPLIT'); end if;
    v_cash := (bill ->> 'total')::int - v_split;
    v_online := v_split;
  end if;

  -- ---- all validation passed: write -----
  insert into public.customers (phone, name, marketing_opt_in, created_at)
  values (v_phone, v_name, case when jsonb_typeof(payload -> 'marketingOptIn') = 'boolean' then (payload ->> 'marketingOptIn')::boolean else false end, v_now)
  on conflict (phone) do update set name = excluded.name, marketing_opt_in = excluded.marketing_opt_in
  returning * into cust;

  insert into public.orders (short_code, customer_id, customer_name, phone, mode, table_number, pickup_time, status,
                             subtotal, discount, loyalty_discount, points_redeemed, taxable, cgst, sgst, total,
                             online_due, payment_status, coupon_code, idempotency_key, created_at, updated_at)
  values ('GG-' || nextval('public.order_code_seq'), cust.id, v_name, v_phone, v_mode, v_table, v_pickup, 'placed',
          (bill ->> 'subtotal')::int, (bill ->> 'couponDiscount')::int, (bill ->> 'loyaltyDiscount')::int,
          (bill ->> 'pointsRedeemed')::int, (bill ->> 'taxable')::int, (bill ->> 'cgst')::int, (bill ->> 'sgst')::int,
          (bill ->> 'total')::int, v_online, 'unpaid', cpn.code, v_key, v_now, v_now)
  returning id into v_order;

  insert into public.order_items (order_id, line_no, item_id, name_snapshot, unit_price, options, qty, note, line_total)
  select v_order, n, l ->> 'itemId', l ->> 'name', (l ->> 'unitPrice')::int,
         coalesce((select jsonb_agg(jsonb_build_object('id', id, 'label', (l -> 'optionLabels') -> (k - 1)::int) order by k)
                     from jsonb_array_elements(l -> 'optionIds') with ordinality x(id, k)), '[]'),
         (l ->> 'qty')::int, l ->> 'note', (l ->> 'lineTotal')::int
    from jsonb_array_elements(bill -> 'lines') with ordinality t(l, n);

  if v_online > 0 then
    insert into public.payments (order_id, method, channel, amount, status, created_at) values (v_order, 'online', 'pending', v_online, 'pending', v_now);
  end if;
  if v_cash > 0 then
    insert into public.payments (order_id, method, channel, amount, status, created_at) values (v_order, 'cash', 'cash', v_cash, 'pending', v_now);
  end if;

  if cpn.code is not null then
    update public.coupons set used_count = used_count + 1 where code = cpn.code;
  end if;
  if (bill ->> 'pointsRedeemed')::int > 0 then
    insert into public.loyalty_ledger (customer_id, order_id, points, reason, created_at)
    values (cust.id, v_order, -(bill ->> 'pointsRedeemed')::int, 'redeem', v_now);
  end if;

  o := public._order_json(v_order);
  perform public._log(v_order, null, v_phone, 'to_customer', public._msg_order_received_customer(o));
  perform public._log(v_order, null, s.whatsapp, 'to_cafe', public._msg_order_received_cafe(o));
  return jsonb_build_object('ok', true, 'order', o, 'onlineDue', v_online);
end $$;

-- Demo stand-in for the payment gateway webhook. The amount is always the server-computed
-- online part of the order; the client amount is only checked against it.
create function public.confirm_online_payment(p_order_id uuid, p_channel text, p_amount integer, p_success boolean, p_reference text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  o public.orders;
  v_row public.payments;
  target uuid;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status in ('rejected', 'cancelled') then raise exception 'ORDER_CLOSED'; end if;
  if exists (select 1 from public.payments where order_id = o.id and method = 'online' and status = 'success') then
    return public._order_for_caller(o.id); -- already paid: idempotent
  end if;

  select * into v_row from public.payments where order_id = o.id and method = 'online' and status = 'pending' order by seq desc limit 1;
  if not found then
    select * into v_row from public.payments where order_id = o.id and method = 'online' and status = 'failed' order by seq desc limit 1;
  end if;
  if v_row.id is null or p_amount is distinct from v_row.amount then raise exception 'BAD_AMOUNT'; end if;
  if p_success is null or p_channel is null
     or p_channel not in ('upi_intent', 'upi_id', 'upi_qr', 'card', 'netbanking', 'wallet', 'paylater')
     or char_length(coalesce(p_reference, '')) > 64 then
    raise exception 'BAD_INPUT';
  end if;

  if v_row.status = 'pending' then
    target := v_row.id;
  else
    insert into public.payments (order_id, method, channel, amount, status, created_at)
    values (o.id, 'online', 'pending', v_row.amount, 'pending', public._now())
    returning id into target;
  end if;
  update public.payments
     set channel = p_channel, reference = p_reference, status = case when p_success then 'success' else 'failed' end
   where id = target;
  perform public._refresh_payment_status(o.id);
  if p_success then
    perform public._log(o.id, null, o.phone, 'to_customer', public._msg_payment_received(public._order_json(o.id), v_row.amount));
  end if;
  return public._order_for_caller(o.id);
end $$;

create function public.get_order_public(p_order_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$ select public._order_public_json(p_order_id) $$;

-- Customer-facing loyalty lookup. Returns only the first name and the points balance.
create function public.lookup_loyalty(p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare c public.customers;
begin
  if char_length(coalesce(p_phone, '')) <= 32 then
    select * into c from public.customers where phone = public._norm_phone(p_phone);
  end if;
  return jsonb_build_object(
    'points', case when c.id is null then 0 else public._points_balance(c.id) end,
    'isFirstOrder', public._is_first_order(c.id),
    'name', public._first_name(c.name));
end $$;

create function public.validate_coupon(p_code text, p_subtotal integer, p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  c public.coupons;
  cid uuid;
  r jsonb;
begin
  if char_length(coalesce(p_code, '')) <= 64 then
    select * into c from public.coupons where code = upper(public._trim(p_code));
  end if;
  if c.code is null then return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;
  if char_length(coalesce(p_phone, '')) <= 32 then
    select id into cid from public.customers where phone = public._norm_phone(p_phone);
  end if;
  r := public._coupon_discount(c, greatest(0, coalesce(p_subtotal, 0)), public._is_first_order(cid));
  if not (r ->> 'ok')::boolean then return r; end if;
  return jsonb_build_object('ok', true, 'coupon', public._coupon_json(c), 'amount', r -> 'amount');
end $$;

-- =========================================================================
-- Staff functions (owner or kitchen)
-- =========================================================================

create function public.record_cash_payment(p_order_id uuid, p_amount integer) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  o public.orders;
  covered integer;
  row_id uuid;
begin
  perform public._require_staff();
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status in ('rejected', 'cancelled') then raise exception 'ORDER_CLOSED'; end if;
  -- Cash due excludes what is paid and the online part that is still pending.
  select coalesce(sum(amount), 0) into covered from public.payments
   where order_id = o.id and (status = 'success' or (status = 'pending' and method = 'online'));
  if p_amount is null or p_amount <= 0 or p_amount > o.total - covered then raise exception 'BAD_AMOUNT'; end if;

  select id into row_id from public.payments where order_id = o.id and method = 'cash' and status = 'pending' order by seq limit 1;
  if row_id is not null then
    update public.payments set amount = p_amount, status = 'success', recorded_by = auth.uid() where id = row_id;
  else
    insert into public.payments (order_id, method, channel, amount, status, created_at, recorded_by)
    values (o.id, 'cash', 'cash', p_amount, 'success', public._now(), auth.uid());
  end if;
  perform public._refresh_payment_status(o.id);
  perform public._log(o.id, null, o.phone, 'to_customer', public._msg_payment_received(public._order_json(o.id), p_amount));
  return public._order_json(o.id);
end $$;

create function public.update_order_status(p_order_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  o public.orders;
  v_now timestamptz := public._now();
  j jsonb;
begin
  perform public._require_staff();
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not coalesce((o.status, p_status) in (('placed', 'accepted'), ('placed', 'rejected'), ('accepted', 'preparing'),
                                           ('accepted', 'cancelled'), ('preparing', 'ready'), ('ready', 'completed')), false) then
    raise exception 'BAD_TRANSITION';
  end if;

  update public.orders set status = p_status, updated_at = v_now where id = o.id;
  if p_status = 'completed' then
    insert into public.loyalty_ledger (customer_id, order_id, points, reason, created_at)
    values (o.customer_id, o.id, greatest(0, floor(o.total / 10.0))::int, 'earn', v_now);
  end if;
  if p_status in ('rejected', 'cancelled') and o.points_redeemed > 0 then
    insert into public.loyalty_ledger (customer_id, order_id, points, reason, created_at)
    values (o.customer_id, o.id, o.points_redeemed, 'adjust', v_now);
  end if;
  j := public._order_json(o.id);
  if p_status <> 'preparing' then
    perform public._log(o.id, null, o.phone, 'to_customer', public._msg_status_update(j));
  end if;
  return j;
end $$;

create function public.set_item_availability(p_item_id text, p_available boolean) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform public._require_staff();
  if p_available is null then raise exception 'BAD_INPUT'; end if;
  update public.menu_items set is_available = p_available where id = p_item_id;
end $$;

create function public.update_customer_notes(p_customer_id uuid, p_notes text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform public._require_staff();
  if p_notes is null or char_length(p_notes) > 500 then raise exception 'BAD_INPUT'; end if;
  update public.customers set notes = p_notes where id = p_customer_id;
end $$;

create function public.get_order(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  perform public._require_staff();
  return public._order_json(p_order_id);
end $$;

-- Newest first; ties keep the most recently inserted first (db.ts newestFirst).
create function public.list_orders(p_from timestamptz default null, p_to timestamptz default null, p_statuses text[] default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  perform public._require_staff();
  return coalesce((
    select jsonb_agg(public._order_json(o.id) order by o.created_at desc, o.seq desc)
      from public.orders o
     where (p_from is null or o.created_at >= p_from)
       and (p_to is null or o.created_at <= p_to)
       and (p_statuses is null or o.status = any (p_statuses))), '[]');
end $$;

create function public._stats_json(s public.customer_stats) returns jsonb
language sql immutable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', s.id, 'phone', s.phone, 'name', s.name, 'marketingOptIn', s.marketing_opt_in, 'notes', s.notes,
    'createdAt', public._iso(s.created_at), 'orders', s.orders, 'totalSpend', s.total_spend,
    'lastOrderAt', public._iso(s.last_order_at), 'avgBill', s.avg_bill, 'favourites', to_jsonb(s.favourites),
    'points', s.points, 'tags', to_jsonb(s.tags))
$$;

create function public.list_customers() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  perform public._require_staff();
  return coalesce((select jsonb_agg(public._stats_json(s) order by s.last_order_at desc nulls last) from public.customer_stats s), '[]');
end $$;

create function public.get_customer(p_customer_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare s public.customer_stats;
begin
  perform public._require_staff();
  select * into s from public.customer_stats where id = p_customer_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'stats', public._stats_json(s),
    'orders', coalesce((select jsonb_agg(public._order_json(o.id) order by o.created_at desc, o.seq desc)
                          from public.orders o where o.customer_id = s.id), '[]'),
    'ledger', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'customerId', l.customer_id, 'orderId', l.order_id,
                                                            'points', l.points, 'reason', l.reason, 'createdAt', public._iso(l.created_at))
                                         order by l.created_at desc, l.seq desc)
                          from public.loyalty_ledger l where l.customer_id = s.id), '[]'));
end $$;

create function public.list_coupons() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  perform public._require_staff();
  return coalesce((select jsonb_agg(public._coupon_json(c) order by c.created_at, c.code) from public.coupons c), '[]');
end $$;

create function public.list_campaigns() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  perform public._require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'segment', c.segment, 'body', c.template,
                                        'sentCount', c.sent_count, 'createdAt', public._iso(c.created_at))
                     order by c.created_at desc)
      from public.campaigns c), '[]');
end $$;

create function public.list_messages(p_order_id uuid default null, p_limit integer default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  perform public._require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'orderId', m.order_id, 'campaignId', m.campaign_id, 'to', m.to_phone,
                                        'direction', m.direction, 'body', m.body, 'createdAt', public._iso(m.created_at))
                     order by m.created_at desc, m.seq desc)
      from (select * from public.message_log
             where p_order_id is null or order_id = p_order_id
             order by created_at desc, seq desc
             limit case when p_limit > 0 then p_limit end) m), '[]');
end $$;

-- =========================================================================
-- Owner functions
-- =========================================================================

create function public.upsert_item(p_item jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id text := public._jstr(p_item -> 'id', 200);
  v_cat text := public._jstr(p_item -> 'categoryId', 200);
  v_name text := public._trim(public._jstr(p_item -> 'name', 120));
  v_price integer := public._jint(p_item -> 'price');
  opt jsonb;
  n integer := 0;
begin
  perform public._require_owner();
  if jsonb_typeof(p_item) is distinct from 'object'
     or v_id is null or v_id !~ '^[A-Za-z0-9_-]+$'
     or not exists (select 1 from public.menu_categories where id = v_cat)
     or v_name is null or v_name = ''
     or v_price is null or v_price < 0 or v_price > 100000
     or jsonb_typeof(p_item -> 'available') is distinct from 'boolean'
     or coalesce(jsonb_typeof(p_item -> 'description'), 'null') not in ('null', 'string') or char_length(coalesce(p_item ->> 'description', '')) > 500
     or coalesce(jsonb_typeof(p_item -> 'image'), 'null') not in ('null', 'string') or char_length(coalesce(p_item ->> 'image', '')) > 300
     or coalesce(jsonb_typeof(p_item -> 'veg'), 'null') not in ('null', 'boolean')
     or coalesce(jsonb_typeof(p_item -> 'egg'), 'null') not in ('null', 'boolean')
     or coalesce(jsonb_typeof(p_item -> 'nutrition'), 'null') not in ('null', 'object') or length(coalesce(p_item ->> 'nutrition', '')) > 300
     or jsonb_typeof(p_item -> 'tags') is distinct from 'array' or jsonb_array_length(p_item -> 'tags') > 10
     or exists (select 1 from jsonb_array_elements(p_item -> 'tags') t where public._jstr(t, 40) is null)
     or jsonb_typeof(p_item -> 'options') is distinct from 'array' or jsonb_array_length(p_item -> 'options') > 50
     or exists (select 1 from jsonb_array_elements(p_item -> 'options') o
                 where public._jstr(o -> 'id', 200) is null or (o ->> 'id') !~ '^[A-Za-z0-9_-]+$'
                    or public._jstr(o -> 'group', 40) is null or public._jstr(o -> 'label', 80) is null
                    or public._jint(o -> 'priceDelta') is null or abs(public._jint(o -> 'priceDelta')) > 100000)
     or exists (select 1 from jsonb_array_elements(p_item -> 'options') o
                  join public.item_options x on x.id = o ->> 'id' where x.item_id <> v_id)
     or (select count(distinct o ->> 'id') from jsonb_array_elements(p_item -> 'options') o) <> jsonb_array_length(p_item -> 'options')
  then
    raise exception 'BAD_INPUT';
  end if;

  insert into public.menu_items (id, category_id, name, description, price, image_url, is_veg, is_egg, tags, is_available, nutrition, sort)
  values (v_id, v_cat, v_name, p_item ->> 'description', v_price, p_item ->> 'image', (p_item ->> 'veg')::boolean,
          (p_item ->> 'egg')::boolean, array(select jsonb_array_elements_text(p_item -> 'tags')),
          (p_item ->> 'available')::boolean, nullif(p_item -> 'nutrition', 'null'::jsonb),
          (select coalesce(max(sort), -1) + 1 from public.menu_items))
  on conflict (id) do update set
    category_id = excluded.category_id, name = excluded.name, description = excluded.description, price = excluded.price,
    image_url = excluded.image_url, is_veg = excluded.is_veg, is_egg = excluded.is_egg, tags = excluded.tags,
    is_available = excluded.is_available, nutrition = excluded.nutrition;

  delete from public.item_options where item_id = v_id;
  for opt in select value from jsonb_array_elements(p_item -> 'options') loop
    insert into public.item_options (id, item_id, group_name, label, price_delta, sort)
    values (opt ->> 'id', v_id, opt ->> 'group', opt ->> 'label', public._jint(opt -> 'priceDelta'), n);
    n := n + 1;
  end loop;
end $$;

-- Shallow merge, like LocalStore ({...settings, ...patch}). Unknown keys or wrong types => BAD_INPUT.
create function public.update_settings(p_patch jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  k text;
  v jsonb;
  ok boolean;
begin
  perform public._require_owner();
  if jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'BAD_INPUT'; end if;
  for k, v in select key, value from jsonb_each(p_patch) loop
    ok := case k
      when 'cafeName' then char_length(public._trim(public._jstr(v, 80))) > 0
      when 'phone' then public._jstr(v, 30) is not null
      when 'whatsapp' then public._jstr(v, 15) ~ '^[0-9]{8,15}$'
      when 'gstPercent' then public._jint(v) between 0 and 28
      when 'acceptingOrders' then jsonb_typeof(v) = 'boolean'
      when 'slotMinutes' then public._jint(v) between 5 and 120
      when 'tables' then public._jint(v) between 1 and 100
      when 'socials' then jsonb_typeof(v) = 'object' and length(v::text) <= 1000
      when 'delivery' then jsonb_typeof(v) = 'object' and length(v::text) <= 1000
      when 'hours' then jsonb_typeof(v) = 'object' and length(v::text) <= 1000
      when 'loyalty' then jsonb_typeof(v) = 'object' and length(v::text) <= 500
      else false end;
    if not coalesce(ok, false) then raise exception 'BAD_INPUT'; end if;
  end loop;

  update public.settings set
    cafe_name = coalesce(public._trim(p_patch ->> 'cafeName'), cafe_name),
    phone = coalesce(p_patch ->> 'phone', phone),
    whatsapp = coalesce(p_patch ->> 'whatsapp', whatsapp),
    gst_percent = coalesce(public._jint(p_patch -> 'gstPercent'), gst_percent),
    accepting_orders = coalesce((p_patch ->> 'acceptingOrders')::boolean, accepting_orders),
    slot_minutes = coalesce(public._jint(p_patch -> 'slotMinutes'), slot_minutes),
    tables = coalesce(public._jint(p_patch -> 'tables'), tables),
    socials = coalesce(p_patch -> 'socials', socials),
    delivery = coalesce(p_patch -> 'delivery', delivery),
    hours = coalesce(p_patch -> 'hours', hours),
    loyalty = coalesce(p_patch -> 'loyalty', loyalty);
end $$;

-- Codes are stored upper-case, so upserts are case-insensitive (LocalStore.upsertCoupon).
create function public.upsert_coupon(p_coupon jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_code text := upper(public._trim(public._jstr(p_coupon -> 'code', 64)));
  v_type text := public._jstr(p_coupon -> 'type');
  v_value integer := public._jint(p_coupon -> 'value');
  v_expires timestamptz;
begin
  perform public._require_owner();
  if jsonb_typeof(p_coupon) is distinct from 'object'
     or v_code is null or v_code !~ '^[A-Z0-9_-]{1,40}$'
     or v_type is null or v_type not in ('percent', 'flat')
     or v_value is null or v_value < 0 or v_value > (case when v_type = 'percent' then 100 else 100000 end)
     or public._jint(p_coupon -> 'minOrder') is null or public._jint(p_coupon -> 'minOrder') < 0
     or (jsonb_typeof(p_coupon -> 'maxDiscount') <> 'null' and coalesce(public._jint(p_coupon -> 'maxDiscount'), -1) < 0)
     or (jsonb_typeof(p_coupon -> 'usageLimit') <> 'null' and coalesce(public._jint(p_coupon -> 'usageLimit'), -1) < 0)
     or public._jint(p_coupon -> 'usedCount') is null or public._jint(p_coupon -> 'usedCount') < 0
     or jsonb_typeof(p_coupon -> 'firstOrderOnly') is distinct from 'boolean'
     or jsonb_typeof(p_coupon -> 'active') is distinct from 'boolean'
     or coalesce(jsonb_typeof(p_coupon -> 'expiresAt'), 'null') not in ('null', 'string')
     or coalesce(jsonb_typeof(p_coupon -> 'maxDiscount'), 'null') not in ('null', 'number')
     or coalesce(jsonb_typeof(p_coupon -> 'usageLimit'), 'null') not in ('null', 'number')
  then
    raise exception 'BAD_INPUT';
  end if;
  begin
    v_expires := public._jstr(p_coupon -> 'expiresAt', 40)::timestamptz;
  exception when others then
    raise exception 'BAD_INPUT';
  end;

  insert into public.coupons (code, type, value, min_order, max_discount, expires_at, usage_limit, used_count, first_order_only, active)
  values (v_code, v_type, v_value, public._jint(p_coupon -> 'minOrder'), public._jint(p_coupon -> 'maxDiscount'), v_expires,
          public._jint(p_coupon -> 'usageLimit'), public._jint(p_coupon -> 'usedCount'),
          (p_coupon ->> 'firstOrderOnly')::boolean, (p_coupon ->> 'active')::boolean)
  on conflict (code) do update set
    type = excluded.type, value = excluded.value, min_order = excluded.min_order, max_discount = excluded.max_discount,
    expires_at = excluded.expires_at, usage_limit = excluded.usage_limit, used_count = excluded.used_count,
    first_order_only = excluded.first_order_only, active = excluded.active;
end $$;

-- db.ts inSegment: opted-in customers whose tags match the segment.
create function public._segment_recipients(p_segment text) returns setof public.customer_stats
language sql stable set search_path = public, pg_temp
as $$
  select * from public.customer_stats s
   where s.marketing_opt_in
     and (p_segment = 'all_opted_in'
          or (p_segment = 'inactive_30d' and 'inactive' = any (s.tags))
          or p_segment = any (s.tags))
$$;

create function public.send_campaign(p_name text, p_segment text, p_body text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c public.campaigns;
  v_now timestamptz := public._now();
begin
  perform public._require_owner();
  if p_name is null or char_length(public._trim(p_name)) not between 1 and 80
     or p_body is null or char_length(p_body) not between 1 and 1000
     or p_segment is null or p_segment not in ('all_opted_in', 'new', 'regular', 'vip', 'inactive_30d') then
    raise exception 'BAD_INPUT';
  end if;

  insert into public.campaigns (name, segment, template, sent_count, created_at)
  values (public._trim(p_name), p_segment, p_body, (select count(*) from public._segment_recipients(p_segment)), v_now)
  returning * into c;

  insert into public.message_log (order_id, campaign_id, to_phone, direction, body, created_at)
  select null, c.id, r.phone, 'to_customer', replace(p_body, '{name}', coalesce(public._first_name(r.name), 'there')), v_now
    from public._segment_recipients(p_segment) r order by r.phone;

  return jsonb_build_object('id', c.id, 'name', c.name, 'segment', c.segment, 'body', c.template,
                            'sentCount', c.sent_count, 'createdAt', public._iso(c.created_at));
end $$;

-- Restores the seed snapshot (seed_* tables), shifted so the seed's anchor time becomes now().
create function public._reseed() returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare d interval := public._now() - (select anchor from public.seed_meta);
begin
  truncate public.message_log, public.campaigns, public.loyalty_ledger, public.payments, public.order_items,
           public.orders, public.customers, public.coupons, public.item_options, public.menu_items,
           public.menu_categories, public.tables, public.settings restart identity;

  insert into public.settings select * from public.seed_settings;
  insert into public.menu_categories select * from public.seed_menu_categories;
  insert into public.menu_items select * from public.seed_menu_items;
  insert into public.item_options select * from public.seed_item_options;
  insert into public.tables select * from public.seed_tables;
  insert into public.customers (id, phone, name, marketing_opt_in, notes, tags, created_at)
    select id, phone, name, marketing_opt_in, notes, tags, created_at + d from public.seed_customers;
  insert into public.coupons (code, type, value, min_order, max_discount, expires_at, usage_limit, used_count, first_order_only, active, created_at)
    select code, type, value, min_order, max_discount, expires_at + d, usage_limit, used_count, first_order_only, active, created_at + d
      from public.seed_coupons;
  insert into public.orders (id, short_code, customer_id, customer_name, phone, mode, table_number, pickup_time, status,
                             subtotal, discount, loyalty_discount, points_redeemed, taxable, cgst, sgst, total, online_due,
                             payment_status, coupon_code, idempotency_key, created_at, updated_at)
    select id, short_code, customer_id, customer_name, phone, mode, table_number,
           case when pickup_time ~ '^[0-9]{2}:[0-9]{2}$' then to_char(pickup_time::time + d, 'HH24:MI') end, status,
           subtotal, discount, loyalty_discount, points_redeemed, taxable, cgst, sgst, total, online_due,
           payment_status, coupon_code, idempotency_key, created_at + d, updated_at + d
      from public.seed_orders order by seq;
  insert into public.order_items select * from public.seed_order_items;
  insert into public.payments (id, order_id, method, channel, amount, status, reference, created_at, recorded_by)
    select id, order_id, method, channel, amount, status, reference, created_at + d, recorded_by from public.seed_payments order by seq;
  insert into public.loyalty_ledger (id, customer_id, order_id, points, reason, created_at)
    select id, customer_id, order_id, points, reason, created_at + d from public.seed_loyalty_ledger order by seq;
  perform setval('public.order_code_seq', (select next_code from public.seed_meta), false);
end $$;

create function public.reset_demo() returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform public._require_owner();
  perform public._reseed();
end $$;
