-- Safe migration for an already-seeded BhashaBill database to add device-key vendor columns.
-- Run this in the Supabase SQL Editor.

alter table public.orders
  add column if not exists vendor_key text,
  add column if not exists vendor_name text,
  add column if not exists vendor_phone text,
  add column if not exists vendor_city text;

update public.orders
set
  vendor_key = coalesce(nullif(vendor_key, ''), 'demo'),
  vendor_name = coalesce(nullif(vendor_name, ''), 'Lakshmi Sweets'),
  vendor_phone = coalesce(nullif(vendor_phone, ''), '919000000000'),
  vendor_city = coalesce(nullif(vendor_city, ''), 'Mysuru')
where vendor_key is null
   or vendor_key = ''
   or vendor_name is null
   or vendor_phone is null
   or vendor_city is null;

alter table public.orders
  alter column vendor_key set not null;

create index if not exists idx_orders_vendor_created
  on public.orders(vendor_key, created_at desc);
