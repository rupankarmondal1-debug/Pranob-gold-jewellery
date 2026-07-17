-- =========================================================
-- Pranab Gold Jewellery — Storage Setup
-- Run after the schema/RLS files. Creates a private bucket for all
-- item, stone-certificate, and inventory photos, with access
-- restricted to signed-in, enabled users (same rule as the tables).
-- =========================================================

insert into storage.buckets (id, name, public)
values ('shop-photos', 'shop-photos', false)
on conflict (id) do nothing;

-- Enabled users can view any photo in the bucket (needed to show
-- item/inventory images anywhere in the app).
drop policy if exists "shop-photos: enabled users can read" on storage.objects;
create policy "shop-photos: enabled users can read"
  on storage.objects for select
  using (bucket_id = 'shop-photos' and public.is_enabled_user());

-- Enabled users can upload new photos.
drop policy if exists "shop-photos: enabled users can upload" on storage.objects;
create policy "shop-photos: enabled users can upload"
  on storage.objects for insert
  with check (bucket_id = 'shop-photos' and public.is_enabled_user());

-- Enabled users can replace/update photo metadata (e.g. re-upload).
drop policy if exists "shop-photos: enabled users can update" on storage.objects;
create policy "shop-photos: enabled users can update"
  on storage.objects for update
  using (bucket_id = 'shop-photos' and public.is_enabled_user());

-- Only admins can delete photos outright.
drop policy if exists "shop-photos: admin can delete" on storage.objects;
create policy "shop-photos: admin can delete"
  on storage.objects for delete
  using (bucket_id = 'shop-photos' and public.is_admin());

-- Suggested folder convention inside the bucket (enforced by app code,
-- not the database):
--   order-items/{order_item_id}/{uuid}.jpg
--   inventory/{inventory_id}/{uuid}.jpg
--   shop-logo/logo.png
