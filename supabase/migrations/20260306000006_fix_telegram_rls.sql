-- Update RLS policies for rsdc_telegram_users to be more permissive for the bot
-- Drop existing restricted policies
DROP POLICY IF EXISTS "Users can view their own telegram link" ON rsdc_telegram_users;
DROP POLICY IF EXISTS "Users can delete their own telegram link" ON rsdc_telegram_users;

-- Allow any authenticated user to view links (needed for the bot to identify users)
CREATE POLICY "Authenticated users can view all telegram links"
    ON rsdc_telegram_users FOR SELECT
    TO authenticated
    USING (true);

-- Allow users to link their own Telegram account
CREATE POLICY "Users can insert their own telegram link"
    ON rsdc_telegram_users FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow users to remove their own Telegram link
CREATE POLICY "Users can delete their own telegram link"
    ON rsdc_telegram_users FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Also ensure public_user can be queried for the linking code by authenticated users
-- (Assuming public_user already exists and has RLS)
-- We need to allow selecting the user_id if we know the link code
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'public_user') THEN
        DROP POLICY IF EXISTS "Allow authenticated to view link codes" ON public_user;
        CREATE POLICY "Allow authenticated to view link codes"
            ON public_user FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END $$;
