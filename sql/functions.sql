-- =========================================================
-- Pranab Gold Jewellery — Functions & Triggers
-- Run after 01_schema.sql
-- =========================================================

-- ---------------------------------------------------------
-- Helper: is the current user an enabled admin / enabled user?
-- Used heavily by RLS policies in 02_rls_policies.sql
-- ---------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and status = 'enabled'
  );
$$;

create or replace function is_enabled_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and status = 'enabled'
  );
$$;

-- ---------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up.
-- The very first user to ever sign up becomes admin automatically;
-- everyone after that defaults to 'staff' (an admin can promote them
-- later from the Admin Panel).
-- ---------------------------------------------------------
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
begin
  select not exists(select 1 from profiles) into is_first;
  insert into profiles (id, email, role, status, must_change_password)
  values (
    new.id, new.email,
    case when is_first then 'admin' else 'staff' end,
    'enabled',
    false
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ---------------------------------------------------------
-- IMPORTANT: block privilege escalation.
-- The RLS policy "profiles: self can update own row" only checks row
-- ownership — it does NOT stop a signed-in user from setting their own
-- role to 'admin' or status to 'enabled' via a direct client update.
-- This trigger is the actual enforcement: only an admin may change
-- someone's role or status, even on their own row.
-- ---------------------------------------------------------
create or replace function prevent_privilege_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not is_admin() then
    raise exception 'Only an admin can change role or status.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on profiles;
create trigger trg_profiles_guard
  before update on profiles
  for each row execute function prevent_privilege_escalation();

-- ---------------------------------------------------------
-- Generic updated_at maintainer
-- ---------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_clients_updated on clients;
create trigger trg_clients_updated before update on clients
  for each row execute function set_updated_at();

drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();

drop trigger if exists trg_order_items_updated on order_items;
create trigger trg_order_items_updated before update on order_items
  for each row execute function set_updated_at();

drop trigger if exists trg_inventory_updated on inventory;
create trigger trg_inventory_updated before update on inventory
  for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Order number generator: PGJ-2026-0001, sequential per year
-- ---------------------------------------------------------
create sequence if not exists order_number_seq;

create or replace function next_order_number(prefix text default 'PGJ') returns text
language plpgsql as $$
declare
  yr text := to_char(current_date, 'YYYY');
  n int;
begin
  select coalesce(max(substring(order_number from '-(\d+)$')::int), 0) + 1
    into n
    from orders
    where order_number like prefix || '-' || yr || '-%';
  return prefix || '-' || yr || '-' || lpad(n::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------
-- Keep order_items.total_gold in sync automatically:
--   total_gold = net_weight + (net_weight * wastage%) - deduct_gold
-- ---------------------------------------------------------
create or replace function compute_total_gold() returns trigger
language plpgsql as $$
begin
  new.total_gold := round(
    (new.net_weight + (new.net_weight * new.wastage_percent / 100.0) - new.deduct_gold)::numeric,
    3
  );
  return new;
end;
$$;

drop trigger if exists trg_order_items_total_gold on order_items;
create trigger trg_order_items_total_gold
  before insert or update of net_weight, wastage_percent, deduct_gold on order_items
  for each row execute function compute_total_gold();

-- ---------------------------------------------------------
-- Gold Ledger automation: whenever an order_item's total_gold or the
-- parent order's status changes, reconcile how much gold is "held"
-- against the client and log the delta to gold_ledger. This mirrors
-- the exact business rule requested: placing an order deducts gold,
-- cancelling/deleting an order returns it, editing adjusts the delta.
-- ---------------------------------------------------------
create or replace function reconcile_gold_deduction(p_order_item_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_item record;
  v_order record;
  v_new_deduction numeric;
  v_delta numeric;
begin
  select * into v_item from order_items where id = p_order_item_id;
  if not found then return; end if;
  select * into v_order from orders where id = v_item.order_id;

  v_new_deduction := case when v_order.status = 'Cancelled' then 0 else v_item.total_gold end;
  v_delta := v_new_deduction - coalesce(v_item.gold_deduction_amount, 0);

  if v_delta <> 0 then
    update clients set gold_available = gold_available - v_delta where id = v_order.client_id;
    insert into gold_ledger (client_id, order_id, type, amount, reason, balance_after, created_by)
    select v_order.client_id, v_order.id,
           case when v_delta > 0 then 'out' else 'in' end,
           abs(v_delta),
           format('Order %s — %s (%s)', v_order.order_number, v_item.item_name,
                  case when v_order.status = 'Cancelled' then 'cancelled, gold returned' else 'gold reconciled' end),
           c.gold_available, auth.uid()
    from clients c where c.id = v_order.client_id;
  end if;

  update order_items set gold_deduction_amount = v_new_deduction where id = p_order_item_id;
end;
$$;

create or replace function trg_reconcile_on_item_change() returns trigger
language plpgsql as $$
begin
  perform reconcile_gold_deduction(new.id);
  return new;
end;
$$;

drop trigger if exists trg_order_items_reconcile on order_items;
create trigger trg_order_items_reconcile
  after insert or update of total_gold on order_items
  for each row execute function trg_reconcile_on_item_change();

-- When an order's status changes (e.g. to Cancelled), reconcile every
-- item under it.
create or replace function trg_reconcile_on_order_status_change() returns trigger
language plpgsql as $$
declare
  item_id uuid;
begin
  if new.status is distinct from old.status then
    for item_id in select id from order_items where order_id = new.id loop
      perform reconcile_gold_deduction(item_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_status_reconcile on orders;
create trigger trg_orders_status_reconcile
  after update of status on orders
  for each row execute function trg_reconcile_on_order_status_change();

-- Return gold when an order_item is deleted outright.
create or replace function trg_reconcile_on_item_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_order record;
begin
  if coalesce(old.gold_deduction_amount, 0) <> 0 then
    select * into v_order from orders where id = old.order_id;
    if found then
      update clients set gold_available = gold_available + old.gold_deduction_amount where id = v_order.client_id;
      insert into gold_ledger (client_id, order_id, type, amount, reason, balance_after, created_by)
      select v_order.client_id, v_order.id, 'in', old.gold_deduction_amount,
             format('Order %s — %s deleted, gold returned', v_order.order_number, old.item_name),
             c.gold_available, auth.uid()
      from clients c where c.id = v_order.client_id;
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_order_items_delete_reconcile on order_items;
create trigger trg_order_items_delete_reconcile
  before delete on order_items
  for each row execute function trg_reconcile_on_item_delete();
