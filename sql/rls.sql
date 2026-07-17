-- =========================================================
-- Pranab Gold Jewellery — Row Level Security
-- Run after 01_schema.sql and 02_functions_triggers.sql
--
-- Model:
--   - Any signed-in user with an 'enabled' profile can READ all
--     shop data and CREATE/UPDATE day-to-day records (clients, orders,
--     items, stones, payments...).
--   - Only 'admin' can: change gold_rates, settings, delete records,
--     manage other users' profiles, and read the full activity log.
--   - A disabled account can do nothing (is_enabled_user() returns
--     false), even though the Supabase Auth account itself still
--     exists — this is the same "app-level disable" limitation noted
--     for Firebase, and is the correct approach without a service-role
--     backend. If you deploy the included Edge Function equivalent
--     later, you can additionally hard-disable via the Auth Admin API.
-- =========================================================

alter table profiles        enable row level security;
alter table clients         enable row level security;
alter table gold_rates      enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table stones          enable row level security;
alter table diamonds        enable row level security;
alter table gold_ledger     enable row level security;
alter table payments        enable row level security;
alter table inventory       enable row level security;
alter table reports         enable row level security;
alter table settings        enable row level security;
alter table activity_logs   enable row level security;

-- ---------------------------------------------------------
-- profiles
-- ---------------------------------------------------------
drop policy if exists "profiles: self or admin can read" on profiles;
create policy "profiles: self or admin can read" on profiles
  for select using (id = auth.uid() or is_admin());

drop policy if exists "profiles: self can update own non-role fields" on profiles;
create policy "profiles: self can update own non-role fields" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles: admin can update anyone" on profiles;
create policy "profiles: admin can update anyone" on profiles
  for update using (is_admin());

-- No client-side INSERT policy: rows are created only by the
-- handle_new_auth_user() trigger (security definer), never directly.
-- No DELETE policy: profiles are never deleted from the client.

-- ---------------------------------------------------------
-- clients
-- ---------------------------------------------------------
drop policy if exists "clients: enabled users can read" on clients;
create policy "clients: enabled users can read" on clients
  for select using (is_enabled_user());
drop policy if exists "clients: enabled users can insert" on clients;
create policy "clients: enabled users can insert" on clients
  for insert with check (is_enabled_user());
drop policy if exists "clients: enabled users can update" on clients;
create policy "clients: enabled users can update" on clients
  for update using (is_enabled_user());
drop policy if exists "clients: admin can delete" on clients;
create policy "clients: admin can delete" on clients
  for delete using (is_admin());

-- ---------------------------------------------------------
-- gold_rates (admin only writes; everyone reads)
-- ---------------------------------------------------------
drop policy if exists "gold_rates: enabled users can read" on gold_rates;
create policy "gold_rates: enabled users can read" on gold_rates
  for select using (is_enabled_user());
drop policy if exists "gold_rates: admin can insert" on gold_rates;
create policy "gold_rates: admin can insert" on gold_rates
  for insert with check (is_admin());
drop policy if exists "gold_rates: admin can delete" on gold_rates;
create policy "gold_rates: admin can delete" on gold_rates
  for delete using (is_admin());

-- ---------------------------------------------------------
-- orders
-- ---------------------------------------------------------
drop policy if exists "orders: enabled users can read" on orders;
create policy "orders: enabled users can read" on orders
  for select using (is_enabled_user());
drop policy if exists "orders: enabled users can insert" on orders;
create policy "orders: enabled users can insert" on orders
  for insert with check (is_enabled_user());
drop policy if exists "orders: enabled users can update" on orders;
create policy "orders: enabled users can update" on orders
  for update using (is_enabled_user());
drop policy if exists "orders: admin can delete" on orders;
create policy "orders: admin can delete" on orders
  for delete using (is_admin());

-- ---------------------------------------------------------
-- order_items
-- ---------------------------------------------------------
drop policy if exists "order_items: enabled users can read" on order_items;
create policy "order_items: enabled users can read" on order_items
  for select using (is_enabled_user());
drop policy if exists "order_items: enabled users can insert" on order_items;
create policy "order_items: enabled users can insert" on order_items
  for insert with check (is_enabled_user());
drop policy if exists "order_items: enabled users can update" on order_items;
create policy "order_items: enabled users can update" on order_items
  for update using (is_enabled_user());
drop policy if exists "order_items: admin can delete" on order_items;
create policy "order_items: admin can delete" on order_items
  for delete using (is_admin());

-- ---------------------------------------------------------
-- stones / diamonds
-- ---------------------------------------------------------
drop policy if exists "stones: enabled users can read" on stones;
create policy "stones: enabled users can read" on stones
  for select using (is_enabled_user());
drop policy if exists "stones: enabled users can insert" on stones;
create policy "stones: enabled users can insert" on stones
  for insert with check (is_enabled_user());
drop policy if exists "stones: enabled users can update" on stones;
create policy "stones: enabled users can update" on stones
  for update using (is_enabled_user());
drop policy if exists "stones: admin can delete" on stones;
create policy "stones: admin can delete" on stones
  for delete using (is_admin());

drop policy if exists "diamonds: enabled users can read" on diamonds;
create policy "diamonds: enabled users can read" on diamonds
  for select using (is_enabled_user());
drop policy if exists "diamonds: enabled users can insert" on diamonds;
create policy "diamonds: enabled users can insert" on diamonds
  for insert with check (is_enabled_user());
drop policy if exists "diamonds: enabled users can update" on diamonds;
create policy "diamonds: enabled users can update" on diamonds
  for update using (is_enabled_user());
drop policy if exists "diamonds: admin can delete" on diamonds;
create policy "diamonds: admin can delete" on diamonds
  for delete using (is_admin());

-- ---------------------------------------------------------
-- gold_ledger — system-maintained (triggers use security definer),
-- but everyone enabled can read it; direct client writes are blocked
-- so the ledger can't be tampered with from the app.
-- ---------------------------------------------------------
drop policy if exists "gold_ledger: enabled users can read" on gold_ledger;
create policy "gold_ledger: enabled users can read" on gold_ledger
  for select using (is_enabled_user());
-- Manual balance adjustments (e.g. "Initial deposit") are inserted by
-- enabled users directly (not via trigger), so allow insert:
drop policy if exists "gold_ledger: enabled users can insert manual entries" on gold_ledger;
create policy "gold_ledger: enabled users can insert manual entries" on gold_ledger
  for insert with check (is_enabled_user());

-- ---------------------------------------------------------
-- payments
-- ---------------------------------------------------------
drop policy if exists "payments: enabled users can read" on payments;
create policy "payments: enabled users can read" on payments
  for select using (is_enabled_user());
drop policy if exists "payments: enabled users can insert" on payments;
create policy "payments: enabled users can insert" on payments
  for insert with check (is_enabled_user());
drop policy if exists "payments: admin can delete" on payments;
create policy "payments: admin can delete" on payments
  for delete using (is_admin());

-- ---------------------------------------------------------
-- inventory
-- ---------------------------------------------------------
drop policy if exists "inventory: enabled users can read" on inventory;
create policy "inventory: enabled users can read" on inventory
  for select using (is_enabled_user());
drop policy if exists "inventory: enabled users can insert" on inventory;
create policy "inventory: enabled users can insert" on inventory
  for insert with check (is_enabled_user());
drop policy if exists "inventory: enabled users can update" on inventory;
create policy "inventory: enabled users can update" on inventory
  for update using (is_enabled_user());
drop policy if exists "inventory: admin can delete" on inventory;
create policy "inventory: admin can delete" on inventory
  for delete using (is_admin());

-- ---------------------------------------------------------
-- reports
-- ---------------------------------------------------------
drop policy if exists "reports: enabled users can read" on reports;
create policy "reports: enabled users can read" on reports
  for select using (is_enabled_user());
drop policy if exists "reports: admin can insert" on reports;
create policy "reports: admin can insert" on reports
  for insert with check (is_admin());
drop policy if exists "reports: admin can delete" on reports;
create policy "reports: admin can delete" on reports
  for delete using (is_admin());

-- ---------------------------------------------------------
-- settings (singleton row)
-- ---------------------------------------------------------
drop policy if exists "settings: enabled users can read" on settings;
create policy "settings: enabled users can read" on settings
  for select using (is_enabled_user());
drop policy if exists "settings: admin can update" on settings;
create policy "settings: admin can update" on settings
  for update using (is_admin());

-- ---------------------------------------------------------
-- activity_logs
-- ---------------------------------------------------------
drop policy if exists "activity_logs: admin can read" on activity_logs;
create policy "activity_logs: admin can read" on activity_logs
  for select using (is_admin());
drop policy if exists "activity_logs: enabled users can insert own actions" on activity_logs;
create policy "activity_logs: enabled users can insert own actions" on activity_logs
  for insert with check (is_enabled_user() and (actor_id = auth.uid() or actor_id is null));
