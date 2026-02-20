-- 1. Create Restaurants Table (Tenant)
create table if not exists restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid references auth.users(id),
  plan text default 'free',
  slug text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Restaurant Access Table (Many-to-Many)
create table if not exists restaurant_access (
  user_id uuid references auth.users(id),
  restaurant_id uuid references restaurants(id),
  role text check (role in ('owner', 'manager', 'device', 'staff')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, restaurant_id)
);

-- 3. Migrate Existing Users -> Restaurants
-- For every user in auth.users, create a restaurant if they don't have one
-- We use a DO block to handle this procedural logic safely
DO $$
DECLARE
    user_record record;
    new_restaurant_id uuid;
BEGIN
    FOR user_record IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
        -- Check if this user already owns a restaurant (to avoid duplicates on re-runs)
        IF NOT EXISTS (SELECT 1 FROM restaurants WHERE owner_id = user_record.id) THEN
            
            -- Insert new restaurant
            INSERT INTO restaurants (owner_id, name, plan)
            VALUES (
                user_record.id, 
                COALESCE(user_record.raw_user_meta_data->>'establishment_name', 'Restaurante de ' || split_part(user_record.email, '@', 1)),
                'free'
            )
            RETURNING id INTO new_restaurant_id;

            -- Grant 'owner' access to the creator
            INSERT INTO restaurant_access (user_id, restaurant_id, role)
            VALUES (user_record.id, new_restaurant_id, 'owner');

        END IF;
    END LOOP;
END $$;

-- 4. Update Empleados Table
-- Add restaurant_id if it doesn't exist (it seems it exists as 'restaurante_id' based on previous context, let's verify and standardize)
-- Checking previous schema in context: "restaurante_id" was used in empleados.
-- We will keep 'restaurante_id' for now to avoid breaking existing code, but ensure it links to restaurants.id

-- Add Foreign Key constraint to restaurants table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'empleados_restaurante_id_fkey_new'
    ) THEN
        -- We might need to drop the old FK if it pointed to auth.users, but for now we just want to ensure data consistency.
        -- Actually, the old schema pointed 'restaurante_id' to auth.users.id.
        -- Since we just created restaurants where owner_id = auth.users.id, 
        -- we need to migrate the 'restaurante_id' in empleados to point to the new 'restaurants.id'.
        
        -- BUT WAIT: The current code uses user.id (owner) as the restaurant identifier.
        -- To make the transition smooth without breaking the app instantaneously:
        -- The field 'restaurante_id' in 'empleados' currently holds the UUID of the USER (Owner).
        -- We want it to hold the UUID of the RESTAURANT.
        
        -- Step A: Add a temporary column
        ALTER TABLE empleados ADD COLUMN IF NOT EXISTS new_restaurant_id uuid references restaurants(id);
        
        -- Step B: Update new_restaurant_id based on the owner's link
        UPDATE empleados e
        SET new_restaurant_id = r.id
        FROM restaurants r
        WHERE e.restaurante_id = r.owner_id;
        
        -- Step C: Swap columns (safely)
        -- We will NOT drop the old column yet to allow rollback. We will just use new_restaurant_id in the future or rename.
        -- For this "fix Role" task, we can just rely on the OWNER_ID for now, 
        -- BUT the prompt asked to "Ensure empleados has restaurant_id".
        
        -- Let's stick to the plan: explicit 'restaurant_id' column.
        -- We renamed it to 'restaurant_id' (English) to distinguish from legacy 'restaurante_id' (Spanish/User).
        ALTER TABLE empleados ADD COLUMN IF NOT EXISTS restaurant_id uuid references restaurants(id);
        
        UPDATE empleados e
        SET restaurant_id = r.id
        FROM restaurants r
        WHERE e.restaurante_id = r.owner_id;

    END IF;
END $$;
