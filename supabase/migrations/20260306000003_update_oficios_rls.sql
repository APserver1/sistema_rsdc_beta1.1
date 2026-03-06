-- Update RLS policies for rsdc_oficios to be more permissive for SELECT
-- This allows any authenticated user to view all oficios, which is standard for shared records.

DROP POLICY IF EXISTS "Users can view their own oficios" ON public.rsdc_oficios;

CREATE POLICY "Authenticated users can view all oficios"
    ON public.rsdc_oficios
    FOR SELECT
    TO authenticated
    USING (true);

-- Ensure other policies still exist or are updated if needed
-- (The ones for INSERT/UPDATE/DELETE usually stay user-specific unless specified otherwise)
