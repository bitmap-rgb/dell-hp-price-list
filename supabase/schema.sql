-- Run this entire file in Supabase Dashboard > SQL Editor.
-- Public users can read active products. Only users whose app_metadata.role is "admin"
-- can insert, update, or delete. Never put the service_role key in frontend code.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('Dell', 'HP')),
  name text not null,
  model text,
  category text not null default 'Other',
  sku text,
  billing_price numeric(12,2) check (billing_price is null or billing_price >= 0),
  offer_price numeric(12,2) check (offer_price is null or offer_price >= 0),
  srp numeric(12,2) check (srp is null or srp >= 0),
  effective_srp numeric(12,2) check (effective_srp is null or effective_srp >= 0),
  offer_start date,
  offer_end date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_dates_valid check (offer_start is null or offer_end is null or offer_end >= offer_start)
);

create index if not exists products_brand_idx on public.products (brand);
create index if not exists products_active_idx on public.products (is_active);
create index if not exists products_name_idx on public.products (name);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists "Anyone can read active products" on public.products;
create policy "Anyone can read active products"
on public.products for select
to anon, authenticated
using (is_active = true or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
on public.products for insert
to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products for delete
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

-- Create admin user in Supabase Dashboard > Authentication > Users.
-- Then assign app_metadata.role = "admin" through a trusted server/admin workflow.
-- Do not allow users to set their own app_metadata role from the browser.
-- See README.md for the recommended secure setup.
