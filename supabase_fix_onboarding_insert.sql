-- Allow users to create their own restaurant during Onboarding
CREATE POLICY "Users can insert their own restaurant" ON restaurants
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());
