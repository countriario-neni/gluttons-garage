-- Gluttons Garage demo: row-level security and grants.
-- The browser holds only the anon key, so this file is the security boundary:
--   * anon: read menu/tables/public settings; write only through the five public functions.
--   * staff (authenticated + staff row): read everything; write only through functions,
--     which check the role (kitchen cannot touch settings, coupons, campaigns, items or reset).
--   * nobody writes tables directly through the API.

-- ---- RLS on every table ------------------------------------------------------

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---- table privileges ---------------------------------------------------------

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;

grant select on public.menu_categories, public.menu_items, public.item_options, public.tables to anon, authenticated;
grant select on public.settings, public.customers, public.orders, public.order_items, public.payments,
                public.loyalty_ledger, public.campaigns, public.message_log, public.coupons, public.staff,
                public.customer_stats to authenticated;

-- Public settings: every Settings field is shown on the public site, so all are exposed.
-- The view runs as its owner (security_invoker off), which is what lets anon read it.
create view public.public_settings as
  select cafe_name, phone, whatsapp, gst_percent, accepting_orders, slot_minutes, tables, socials, delivery, hours, loyalty
    from public.settings;
revoke all on public.public_settings from public, anon, authenticated;
grant select on public.public_settings to anon, authenticated;

-- ---- policies ---------------------------------------------------------------------

create policy menu_categories_read on public.menu_categories for select to anon, authenticated using (true);
create policy menu_items_read on public.menu_items for select to anon, authenticated using (true);
create policy item_options_read on public.item_options for select to anon, authenticated using (true);
create policy tables_read on public.tables for select to anon, authenticated using (true);

create policy settings_staff_read on public.settings for select to authenticated using (public.is_staff());
create policy customers_staff_read on public.customers for select to authenticated using (public.is_staff());
create policy orders_staff_read on public.orders for select to authenticated using (public.is_staff());
create policy order_items_staff_read on public.order_items for select to authenticated using (public.is_staff());
create policy payments_staff_read on public.payments for select to authenticated using (public.is_staff());
create policy loyalty_ledger_staff_read on public.loyalty_ledger for select to authenticated using (public.is_staff());
create policy campaigns_staff_read on public.campaigns for select to authenticated using (public.is_staff());
create policy message_log_staff_read on public.message_log for select to authenticated using (public.is_staff());
create policy coupons_staff_read on public.coupons for select to authenticated using (public.is_staff());
create policy staff_read on public.staff for select to authenticated using (user_id = auth.uid() or public.is_staff());
-- seed_* tables: RLS on, no policies, no grants => unreachable from the API.

-- ---- function privileges --------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.place_order(jsonb),
  public.confirm_online_payment(uuid, text, integer, boolean, text),
  public.get_order_public(uuid),
  public.lookup_loyalty(text),
  public.validate_coupon(text, integer, text)
to anon, authenticated;

-- Staff/owner functions check the caller's role themselves (UNAUTHENTICATED / FORBIDDEN).
grant execute on function
  public.is_staff(),
  public.record_cash_payment(uuid, integer),
  public.update_order_status(uuid, text),
  public.set_item_availability(text, boolean),
  public.update_customer_notes(uuid, text),
  public.get_order(uuid),
  public.list_orders(timestamptz, timestamptz, text[]),
  public.list_customers(),
  public.get_customer(uuid),
  public.list_coupons(),
  public.list_campaigns(),
  public.list_messages(uuid, integer),
  public.upsert_item(jsonb),
  public.update_settings(jsonb),
  public.upsert_coupon(jsonb),
  public.send_campaign(text, text, text),
  public.reset_demo()
to authenticated;

-- Functions created later must be granted explicitly too.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
