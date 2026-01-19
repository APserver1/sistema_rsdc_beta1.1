-- Add signature spacing column to rsdc_oficios table
ALTER TABLE public.rsdc_oficios 
ADD COLUMN IF NOT EXISTS espaciado_firma INTEGER DEFAULT 4;
