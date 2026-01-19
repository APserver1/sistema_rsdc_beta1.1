-- Add firmante columns to rsdc_oficios table
ALTER TABLE public.rsdc_oficios 
ADD COLUMN IF NOT EXISTS firmante_nombre TEXT DEFAULT 'Mtr. Jose Rene Hernandez Jiménez',
ADD COLUMN IF NOT EXISTS firmante_cargo TEXT DEFAULT 'Administrador',
ADD COLUMN IF NOT EXISTS firmante_institucion TEXT DEFAULT 'Region Sanitaria Deptal. De Cortes';
