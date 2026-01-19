-- Add addressee columns to rsdc_oficios table
ALTER TABLE public.rsdc_oficios 
ADD COLUMN IF NOT EXISTS destinatario_tipo TEXT DEFAULT 'persona', -- 'persona' or 'empresa'
ADD COLUMN IF NOT EXISTS destinatario_titulo TEXT DEFAULT 'LIC.',
ADD COLUMN IF NOT EXISTS destinatario_nombre TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS destinatario_cargo TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS destinatario_institucion TEXT DEFAULT '';
