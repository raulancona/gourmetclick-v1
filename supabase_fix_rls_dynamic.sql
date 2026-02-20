-- SAFE RLS FIX: Dynamic Policy Generation
-- This script checks if columns exist BEFORE querying them to avoid "column does not exist" errors.

DO $$ 
DECLARE
    policy_query text;
BEGIN

    ---------------------------------------------------------------------------
    -- 1. CORTES_CAJA
    ---------------------------------------------------------------------------
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cortes_caja') THEN
        
        -- Enable RLS
        ALTER TABLE cortes_caja ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation for Cortes" ON cortes_caja;
        
        -- Case A: Direct 'restaurante_id' exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cortes_caja' AND column_name = 'restaurante_id') THEN
            policy_query := 'CREATE POLICY "Tenant Isolation for Cortes" ON cortes_caja FOR ALL TO authenticated USING (
                restaurante_id = auth.uid() 
                OR 
                restaurante_id IN (
                    SELECT owner_id FROM restaurants 
                    WHERE id IN (SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid())
                )
            )';
            EXECUTE policy_query;
            RAISE NOTICE 'Applied Direct RLS to cortes_caja (via restaurante_id)';

        -- Case B: Indirect via 'sesion_caja_id'
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cortes_caja' AND column_name = 'sesion_caja_id') THEN
            policy_query := 'CREATE POLICY "Tenant Isolation for Cortes" ON cortes_caja FOR ALL TO authenticated USING (
                sesion_caja_id IN (
                    SELECT id FROM sesiones_caja WHERE restaurante_id = auth.uid()
                    OR restaurante_id IN (
                        SELECT owner_id FROM restaurants 
                        WHERE id IN (SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid())
                    )
                )
            )';
            EXECUTE policy_query;
            RAISE NOTICE 'Applied Indirect RLS to cortes_caja (via sesion_caja_id)';
            
        ELSE
            RAISE NOTICE 'WARNING: cortes_caja exists but has neither restaurante_id nor sesion_caja_id. No policy applied.';
        END IF;

    END IF;

    ---------------------------------------------------------------------------
    -- 2. CASH_CUTS
    ---------------------------------------------------------------------------
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_cuts') THEN
        
        ALTER TABLE cash_cuts ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation for Cash Cuts" ON cash_cuts;
        
        -- Case A: Direct 'restaurant_id' (English)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_cuts' AND column_name = 'restaurant_id') THEN
            policy_query := 'CREATE POLICY "Tenant Isolation for Cash Cuts" ON cash_cuts FOR ALL TO authenticated USING (
                restaurant_id IN (
                   SELECT id FROM restaurants WHERE owner_id = auth.uid()
                )
                OR
                restaurant_id IN (
                   SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid()
                )
            )';
            EXECUTE policy_query;
            RAISE NOTICE 'Applied RLS to cash_cuts (via restaurant_id)';

        -- Case B: Direct 'restaurante_id' (Spanish)
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_cuts' AND column_name = 'restaurante_id') THEN
            policy_query := 'CREATE POLICY "Tenant Isolation for Cash Cuts" ON cash_cuts FOR ALL TO authenticated USING (
                 restaurante_id = auth.uid()
                 OR
                 restaurante_id IN (
                    SELECT owner_id FROM restaurants 
                    WHERE id IN (SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid())
                 )
            )';
            EXECUTE policy_query;
            RAISE NOTICE 'Applied RLS to cash_cuts (via restaurante_id)';

        ELSE
            RAISE NOTICE 'WARNING: cash_cuts exists but implies no known tenant column. No policy applied.';
        END IF;
        
    END IF;

END $$;
