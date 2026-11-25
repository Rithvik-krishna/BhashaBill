-- BhashaBill Supabase Postgres Schema
-- Run this in the Supabase SQL Editor first, followed by supabase/seed.sql.

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  customer_name text not null,
  customer_phone text,
  language text not null check (language in ('kn', 'hi', 'ta', 'en')),
  transcript text not null default '',
  total numeric(12, 2) not null check (total >= 0),
  advance_paid numeric(12, 2) not null default 0 check (advance_paid >= 0),
  due_date date,
  due_date_text text,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  name_original text not null,
  name_english text not null,
  quantity numeric(10, 3) not null check (quantity > 0),
  unit text,
  rate numeric(12, 2) not null check (rate > 0),
  amount numeric(12, 2) not null check (amount >= 0),
  sort_order integer not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant text not null check (variant in ('polite', 'firm')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_slug on public.orders(slug);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id, sort_order);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_reminders_order_id on public.reminders(order_id);
