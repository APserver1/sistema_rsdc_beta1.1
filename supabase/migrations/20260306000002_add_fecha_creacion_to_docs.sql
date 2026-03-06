-- Add fecha_creacion column to documentos_en_direccion
ALTER TABLE documentos_en_direccion ADD COLUMN IF NOT EXISTS fecha_creacion DATE DEFAULT CURRENT_DATE;
