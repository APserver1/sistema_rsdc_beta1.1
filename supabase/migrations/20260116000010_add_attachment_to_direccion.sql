-- Add archivo_adjunto column to rsdc_direccion_documentos
ALTER TABLE public.rsdc_direccion_documentos 
ADD COLUMN IF NOT EXISTS archivo_adjunto TEXT;

-- Create storage bucket for direccion documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('direccion_documentos', 'direccion_documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'direccion_documentos');

-- Policy to allow authenticated users to update files
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'direccion_documentos');

-- Policy to allow public viewing (or authenticated)
CREATE POLICY "Allow public viewing"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'direccion_documentos');
