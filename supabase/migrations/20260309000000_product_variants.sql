-- PRODUCT VARIANTS & GLOBAL MODIFIERS SCHEMA MIGRATION

-- 1. Create product variants table
create table if not exists public.product_variants (
    id uuid primary key default uuid_generate_v4(),
    product_id uuid not null references public.products(id) on delete cascade,
    restaurant_id uuid not null references public.restaurants(id) on delete cascade,
    name text not null,
    price numeric not null check (price >= 0),
    costo numeric default 0 check (costo >= 0),
    sku text,
    is_available boolean default true,
    sort_order integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on product_variants
alter table public.product_variants enable row level security;

-- Policies for product_variants
create policy "Users can view variants for their associated restaurants"
    on public.product_variants for select
    using (
        restaurant_id in (
            select ra.restaurant_id from public.restaurant_access ra where ra.user_id = auth.uid()
        )
    );

create policy "Users can manage variants for their associated restaurants"
    on public.product_variants for all
    using (
        restaurant_id in (
            select ra.restaurant_id from public.restaurant_access ra where ra.user_id = auth.uid()
        )
    );

-- 2. Modify products table to support variants indicator
alter table public.products add column if not exists has_variants boolean default false;

-- 3. Update modifier_groups for Global access
-- Add restaurant_id so groups can be global to a tenant
alter table public.modifier_groups add column if not exists restaurant_id uuid references public.restaurants(id) on delete cascade;

-- Make product_id nullable since a group can exist globally without being directly tied to one product
alter table public.modifier_groups alter column product_id drop not null;

-- Try to backfill restaurant_id for existing modifier groups based on the product they are linked to
update public.modifier_groups mg
set restaurant_id = p.restaurant_id
from public.products p
where mg.product_id = p.id and mg.restaurant_id is null;

-- 4. Create junction table for Product -> Global Modifier Groups
create table if not exists public.product_modifier_groups (
    product_id uuid not null references public.products(id) on delete cascade,
    modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
    sort_order integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (product_id, modifier_group_id)
);

-- Enable RLS on product_modifier_groups
alter table public.product_modifier_groups enable row level security;

-- Policies for product_modifier_groups
create policy "Users can view associated modifier groups"
    on public.product_modifier_groups for select
    using (
        product_id in (
            select p.id from public.products p 
            where p.restaurant_id in (
                select ra.restaurant_id from public.restaurant_access ra where ra.user_id = auth.uid()
            )
        )
    );

create policy "Users can manage associated modifier groups"
    on public.product_modifier_groups for all
    using (
        product_id in (
            select p.id from public.products p 
            where p.restaurant_id in (
                select ra.restaurant_id from public.restaurant_access ra where ra.user_id = auth.uid()
            )
        )
    );

-- Backfill: For existing modifier_groups tied to a product, create an entry in the junction table
insert into public.product_modifier_groups (product_id, modifier_group_id)
select product_id, id from public.modifier_groups where product_id is not null
on conflict (product_id, modifier_group_id) do nothing;
