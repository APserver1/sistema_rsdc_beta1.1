-- Add margen_superior column to rsdc_oficios table
ALTER TABLE public.rsdc_oficios 
ADD COLUMN IF NOT EXISTS margen_superior INTEGER DEFAULT 0;
