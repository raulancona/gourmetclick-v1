-- Enable RLS and Configure Policies for Multi-Tenancy
-- Target: Post-Migration Schema (Owner-based Tenant ID + Restaurant Access)

DO $$ 
BEGIN

    ---------------------------------------------------------------------------
    -- 1. RESTAURANTS
    ---------------------------------------------------------------------------
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'restaurants') THEN
        ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can view own restaurant or assigned" ON restaurants;
        DROP POLICY IF EXISTS "Owners can update own restaurant" ON restaurants;
        
        -- Staff can View the Restaurant details
        CREATE POLICY "Users can view own restaurant or assigned" ON restaurants
            FOR SELECT TO authenticated
            USING (
                owner_id = auth.uid() 
                OR 
                id IN (SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid())
            );

        -- Only Owner can Edit the Restaurant details
        CREATE POLICY "Owners can update own restaurant" ON restaurants
            FOR ALL TO authenticated
            USING (owner_id = auth.uid());
    END IF;

    ---------------------------------------------------------------------------
    -- 2. RESTAURANT_ACCESS
    ---------------------------------------------------------------------------
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'restaurant_access') THEN
        ALTER TABLE restaurant_access ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can view own access" ON restaurant_access;
        DROP POLICY IF EXISTS "Owners can view access" ON restaurant_access;

        -- Strict Rule: User sees their own access row
        CREATE POLICY "Users can view own access" ON restaurant_access
            FOR SELECT TO authenticated
            USING (user_id = auth.uid());

        -- Practical Rule: Owner sees who has access to their restaurant
        CREATE POLICY "Owners can view access" ON restaurant_access
            FOR SELECT TO authenticated
            USING (
                restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
            );
            
        -- Only Owner can INSERT/UPDATE/DELETE access (manage staff)
        CREATE POLICY "Owners can manage access" ON restaurant_access
            FOR INSERT TO authenticated
            WITH CHECK (
                restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
            );
        
        CREATE POLICY "Owners can delete access" ON restaurant_access
            FOR DELETE TO authenticated
            USING (
                restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid())
            );
    END IF;

    ---------------------------------------------------------------------------
    -- 3. ORDERS (Legacy Key: user_id = Owner ID)
    ---------------------------------------------------------------------------
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
        ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation for Orders" ON orders;
        
        CREATE POLICY "Tenant Isolation for Orders" ON orders
            FOR ALL TO authenticated
            USING (
                -- I am the Owner
                user_id = auth.uid() 
                OR 
                -- I am Staff for the Owner
                user_id IN (
                    SELECT owner_id FROM restaurants 
                    WHERE id IN (SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid())
                )
            );
    END IF;

    ---------------------------------------------------------------------------
    -- 4. PRODUCTS (Legacy Key: user_id = Owner ID)
    ---------------------------------------------------------------------------
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products') THEN
        ALTER TABLE products ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation for Products" ON products;
        
        CREATE POLICY "Tenant Isolation for Products" ON products
            FOR ALL TO authenticated
            USING (
                user_id = auth.uid() 
                OR 
                user_id IN (
                    SELECT owner_id FROM restaurants 
                    WHERE id IN (SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid())
                )
            );
    END IF;

    ---------------------------------------------------------------------------
    -- 5. CATEGORIES (Legacy Key: user_id = Owner ID)
    ---------------------------------------------------------------------------
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') THEN
        ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation for Categories" ON categories;
        
        CREATE POLICY "Tenant Isolation for Categories" ON categories
            FOR ALL TO authenticated
            USING (
                user_id = auth.uid() 
                OR 
                user_id IN (
                    SELECT owner_id FROM restaurants 
                    WHERE id IN (SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid())
                )
            );
    END IF;

    ---------------------------------------------------------------------------
    -- 6. SESIONES_CAJA (Legacy Key: restaurante_id = Owner ID)
    ---------------------------------------------------------------------------
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sesiones_caja') THEN
        ALTER TABLE sesiones_caja ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation for Sessions" ON sesiones_caja;
        
        CREATE POLICY "Tenant Isolation for Sessions" ON sesiones_caja
            FOR ALL TO authenticated
            USING (
                restaurante_id = auth.uid() 
                OR 
                restaurante_id IN (
                    SELECT owner_id FROM restaurants 
                    WHERE id IN (SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid())
                )
            );
    END IF;

    ---------------------------------------------------------------------------
    -- 7. GASTOS (Key: sucursal_id = Owner ID)
    ---------------------------------------------------------------------------
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gastos') THEN
        ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation for Expenses" ON gastos;
        
        CREATE POLICY "Tenant Isolation for Expenses" ON gastos
            FOR ALL TO authenticated
            USING (
                sucursal_id = auth.uid() 
                OR 
                sucursal_id IN (
                    SELECT owner_id FROM restaurants 
                    WHERE id IN (SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid())
                )
            );
    END IF;

    ---------------------------------------------------------------------------
    -- 8. EMPLEADOS (Key: restaurante_id = Owner ID)
    ---------------------------------------------------------------------------
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'empleados') THEN
        ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation for Employees" ON empleados;
        
        CREATE POLICY "Tenant Isolation for Employees" ON empleados
            FOR ALL TO authenticated
            USING (
                restaurante_id = auth.uid() 
                OR 
                restaurante_id IN (
                    SELECT owner_id FROM restaurants 
                    WHERE id IN (SELECT restaurant_id FROM restaurant_access WHERE user_id = auth.uid())
                )
            );
    END IF;

    ---------------------------------------------------------------------------
    -- 9. OPTIONAL: cash_cuts / cortes_caja
    ---------------------------------------------------------------------------
    -- If 'cortes_caja' exists, likely linked to sessions
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cortes_caja') THEN
        ALTER TABLE cortes_caja ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation for Cortes" ON cortes_caja;
        
        -- Fallback logic for cortes_caja ownership
        -- Assuming it has 'restaurante_id' or 'sesion_caja_id'
        -- We will use a generic check if columns exist dynamically or just be strict if we knew the schema.
        -- Given uncertainty, we skip specific columns if unknown, but assuming standard 'restaurante_id' exists:
        
        /* Note: Commented out to avoid SQL error if column missing. 
           If needed, add column check here. 
           For now, assuming standard multi-tenant RLS is applied manually to custom tables.
        */
    END IF;

END $$;
