# Pranab Gold Jewellery — Supabase Edition

## Setup

1. **Create a Supabase project** at https://supabase.com/dashboard

2. **Run the SQL files in order** (Supabase Dashboard → SQL Editor):
   ```
   sql/schema.sql
   sql/functions.sql
   sql/rls.sql
   sql/storage.sql
   ```

3. **Copy environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from
   Supabase Dashboard → Settings → API.

4. **Install & run**
   ```bash
   npm install
   npm run dev
   ```

5. **Create the first Admin**
   Open the app → "Create the first Admin account" on the login page.
   The first person to ever sign up is automatically made Admin
   (via the `handle_new_auth_user` trigger). Everyone after that
   defaults to Staff — promote them from the Admin Panel.

## Project structure

```
sql/schema.sql        13 tables: profiles, clients, orders, order_items,
                       gold_ledger, payments, stones, diamonds, gold_rates,
                       inventory, reports, settings, activity_logs
sql/functions.sql      triggers: profile bootstrap, order numbering,
                       total_gold calculation, automatic gold ledger
                       reconciliation, privilege-escalation guard
sql/rls.sql            Row Level Security policies for every table
sql/storage.sql        'shop-photos' bucket + storage policies

src/lib/supabase.js    createClient() + Remember Me storage adapter
src/lib/storage.js     Supabase Storage upload/delete helpers
src/context/AuthContext.jsx   session, role, inactivity auto-logout,
                       activity logging
src/components/ProtectedRoute.jsx   route guard (UX layer — RLS is the
                       real security boundary)
src/components/AppLayout.jsx        sidebar shell
src/pages/*.jsx         Login, Signup, ForgotPassword, ChangePassword,
                       DisabledAccount, Dashboard, Clients, Orders,
                       GoldRate, Reports, Settings, AdminPanel
```

## Notes on scope

- **Fully wired**: auth (login/signup/forgot-reset/change password,
  remember me, inactivity logout, rate limiting), RLS on every table,
  Clients (full CRUD + gold ledger view), Orders (create + status +
  delete, with gold ledger auto-reconciled by DB trigger — no client
  JS needed), Gold Rate, Settings, Admin Panel (create/role/status/
  reset password), Activity Log.
- **Scaffolded, ready to extend**: `stones` and `diamonds` tables +
  RLS exist and are queryable, but the Orders page UI currently
  covers one item per order without a stone/diamond sub-form — add
  rows via `supabase.from("stones").insert(...)` /
  `supabase.from("diamonds").insert(...)` keyed to `order_items.id`,
  following the same pattern as `Clients.jsx`. `inventory` and
  `reports` tables exist with RLS but don't have a dedicated page yet.
- **Account disable** is enforced at the app level (`profiles.status`
  checked by RLS's `is_enabled_user()`), not a true Supabase Auth
  ban — that requires the service-role Admin API from a server
  context (an Edge Function), which is outside what a pure client
  app can safely do.
