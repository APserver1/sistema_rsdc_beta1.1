-- Add spacing columns to rsdc_oficios table
ALTER TABLE public.rsdc_oficios 
ADD COLUMN IF NOT EXISTS espaciado_cabecera_destinatario INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS espaciado_destinatario_saludo INTEGER DEFAULT 2;
