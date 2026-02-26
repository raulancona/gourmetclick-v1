-- ============================================================
-- FIX: Public Menu Order Submission — RLS policies for anon
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 1. PROFILES — Anon puede leer por slug (para cargar el menú público) ───
DROP POLICY IF EXISTS "Public can read profiles by slug" ON profiles;
CREATE POLICY "Public can read profiles by slug"
ON profiles
FOR SELECT
TO anon
USING (slug IS NOT NULL);

-- ─── 2. RESTAURANTS — Anon puede leer para resolver FK restaurant_id ─────────
DROP POLICY IF EXISTS "Public can read restaurants" ON restaurants;
CREATE POLICY "Public can read restaurants"
ON restaurants
FOR SELECT
TO anon
USING (true);

-- ─── 3. CATEGORIES — Anon puede leer categorías del menú ─────────────────────
DROP POLICY IF EXISTS "Public can read categories" ON categories;
CREATE POLICY "Public can read categories"
ON categories
FOR SELECT
TO anon
USING (true);

-- ─── 4. PRODUCTS — Anon puede leer productos disponibles ─────────────────────
DROP POLICY IF EXISTS "Public can read products" ON products;
CREATE POLICY "Public can read products"
ON products
FOR SELECT
TO anon
USING (is_available = true);

-- ─── 5. ORDERS — Anon puede INSERTAR órdenes públicas ────────────────────────
DROP POLICY IF EXISTS "Public can insert orders" ON orders;
CREATE POLICY "Public can insert orders"
ON orders
FOR INSERT
TO anon
WITH CHECK (
    order_type IN ('pickup', 'delivery', 'dine_in')
);

-- ─── 6. ORDERS — Anon puede SELECT la orden recién insertada (para .select()) ─
DROP POLICY IF EXISTS "Public can select own public orders" ON orders;
CREATE POLICY "Public can select own public orders"
ON orders
FOR SELECT
TO anon
USING (
    order_type IN ('pickup', 'delivery', 'dine_in')
);
