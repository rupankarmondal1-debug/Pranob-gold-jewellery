-- =========================================================
-- Pranab Gold Jewellery — Database Schema
-- Run this in Supabase SQL Editor (or via `supabase db push`)
-- =========================================================
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------
-- profiles — one row per auth.users, holds role/status
-- ---------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'staff' check (role in ('admin','staff')),
  status text not null default 'enabled' check (status in ('enabled','disabled')),
  must_change_password boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- clients
-- ---------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text,
  nid text,
  gold_available numeric not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clients_phone on clients(phone);
create index if not exists idx_clients_name on clients using gin (to_tsvector('simple', name));

-- ---------------------------------------------------------
-- gold_rates — daily rate per carat (append-only history)
-- ---------------------------------------------------------
create table if not exists gold_rates (
  id uuid primary key default gen_random_uuid(),
  carat text not null check (carat in ('18','21','22','24')),
  rate_per_gram numeric not null check (rate_per_gram >= 0),
  effective_date date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_gold_rates_carat_date on gold_rates(carat, effective_date desc);

-- ---------------------------------------------------------
-- orders — the transaction header (one client, one delivery)
-- ---------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  client_id uuid not null references clients(id) on delete restrict,
  order_date date not null default current_date,
  delivery_date date not null,
  status text not null default 'Pending' check (status in ('Pending','In Progress','Delivered','Cancelled')),
  advance numeric not null default 0,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_client on orders(client_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_delivery_date on orders(delivery_date);

-- ---------------------------------------------------------
-- order_items — each jewellery piece within an order
-- ---------------------------------------------------------
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_name text not null,
  category text,
  carat text not null check (carat in ('18','21','22','24')),
  net_weight numeric not null default 0 check (net_weight >= 0),
  wastage_percent numeric not null default 0 check (wastage_percent >= 0),
  deduct_gold numeric not null default 0 check (deduct_gold >= 0),
  making_type text not null default 'per_gram' check (making_type in ('per_gram','flat')),
  making_charge numeric not null default 0 check (making_charge >= 0),
  -- total_gold is derived and cached (kept in sync by trigger below) so
  -- reports can query it directly without recomputing every time.
  total_gold numeric not null default 0,
  gold_deduction_amount numeric not null default 0,
  photo_urls text[] not null default '{}',
  photo_captions jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_order_items_order on order_items(order_id);

-- ---------------------------------------------------------
-- stones — general gemstones (non-diamond) on an order item
-- ---------------------------------------------------------
create table if not exists stones (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  stone_type text not null check (stone_type in ('CZ','Ruby','Emerald','Sapphire','Pearl','Other')),
  stone_name text,
  quantity int not null default 1 check (quantity >= 1),
  weight_ct numeric not null default 0,
  size_mm text,
  shape text,
  color text,
  certificate_number text,
  rate_type text not null default 'per_carat' check (rate_type in ('per_carat','per_piece')),
  rate numeric not null default 0,
  stone_status text not null default 'Shop Stone' check (stone_status in ('Shop Stone','Customer Stone')),
  returned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_stones_order_item on stones(order_item_id);

-- ---------------------------------------------------------
-- diamonds — diamond-specific entries (4Cs + certification)
-- ---------------------------------------------------------
create table if not exists diamonds (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  stone_name text,
  quantity int not null default 1 check (quantity >= 1),
  weight_ct numeric not null default 0,
  size_mm text,
  shape text check (shape in ('Round','Princess','Oval','Cushion','Marquise','Pear','Emerald Cut','Heart','Asscher','Radiant','Other')),
  color text,                 -- e.g. D–Z scale
  clarity text check (clarity in ('FL','IF','VVS1','VVS2','VS1','VS2','SI1','SI2','I1','I2','I3','N/A')),
  cut text,                   -- e.g. Excellent / Very Good / Good
  certificate_number text,    -- e.g. GIA report number
  certificate_lab text,       -- e.g. GIA, IGI, HRD
  rate_type text not null default 'per_carat' check (rate_type in ('per_carat','per_piece')),
  rate numeric not null default 0,
  stone_status text not null default 'Shop Stone' check (stone_status in ('Shop Stone','Customer Stone')),
  returned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_diamonds_order_item on diamonds(order_item_id);

-- ---------------------------------------------------------
-- gold_ledger — full audit trail of every client gold in/out
-- ---------------------------------------------------------
create table if not exists gold_ledger (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  type text not null check (type in ('in','out')),
  amount numeric not null check (amount > 0),
  reason text,
  balance_after numeric,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_gold_ledger_client on gold_ledger(client_id, created_at desc);

-- ---------------------------------------------------------
-- payments
-- ---------------------------------------------------------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_date date not null default current_date,
  method text not null default 'cash' check (method in ('cash','card','bank_transfer','mobile_banking','other')),
  type text not null default 'advance' check (type in ('advance','due','full','refund')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_order on payments(order_id);
create index if not exists idx_payments_client on payments(client_id);

-- ---------------------------------------------------------
-- inventory — shop-owned stock (not tied to a client order)
-- ---------------------------------------------------------
create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text,
  carat text check (carat in ('18','21','22','24')),
  gross_weight numeric not null default 0,
  quantity int not null default 1,
  location text,
  status text not null default 'in_stock' check (status in ('in_stock','reserved','sold')),
  photo_urls text[] not null default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- reports — saved/generated report snapshots
-- ---------------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('daily','weekly','monthly','yearly','custom')),
  period_start date not null,
  period_end date not null,
  data jsonb not null default '{}',
  generated_by uuid references profiles(id),
  generated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- settings — single-row shop configuration
-- ---------------------------------------------------------
create table if not exists settings (
  id int primary key default 1 check (id = 1), -- singleton row
  shop_name text not null default 'Pranab Gold Jewellery',
  phone text,
  address text,
  gst text,
  currency text not null default '₹',
  invoice_prefix text not null default 'PGJ',
  default_wastage numeric not null default 8,
  logo_url text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------
-- activity_logs — audit trail for auth + important actions
-- ---------------------------------------------------------
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  actor_email text,
  action text not null, -- e.g. 'login','logout','order_created','role_changed'...
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_logs_created on activity_logs(created_at desc);
