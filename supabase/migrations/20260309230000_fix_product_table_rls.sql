-- DEFINITIVE FIX: product_variants RLS
-- tenant.id is the restaurant UUID from restaurants table (NOT auth.uid())
-- Correct pattern: join through restaurants table to find owner

DROP POLICY IF EXISTS "product_variants_full_access" ON product_variants;
DROP POLICY IF EXISTS "product_variants_owner_or_staff" ON product_variants;

CREATE POLICY "product_variants_owner_or_staff"
ON product_variants FOR ALL TO authenticated
USING (
    restaurant_id IN (
        SELECT id FROM restaurants WHERE owner_id = auth.uid()
        UNION
        SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    restaurant_id IN (
        SELECT id FROM restaurants WHERE owner_id = auth.uid()
        UNION
        SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "product_modifier_groups_full_access" ON product_modifier_groups;
DROP POLICY IF EXISTS "product_modifier_groups_owner_or_staff" ON product_modifier_groups;

CREATE POLICY "product_modifier_groups_owner_or_staff"
ON product_modifier_groups FOR ALL TO authenticated
USING (
    product_id IN (
        SELECT id FROM products WHERE restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
            UNION
            SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid()
        )
    )
)
WITH CHECK (
    product_id IN (
        SELECT id FROM products WHERE restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
            UNION
            SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid()
        )
    )
);
