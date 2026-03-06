-- Create the new table for documents in management
CREATE TABLE IF NOT EXISTS documentos_en_direccion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    numero_documento TEXT NOT NULL,
    quien_recibio TEXT NOT NULL DEFAULT 'Libni' CHECK (quien_recibio IN ('Libni', 'Sharon')),
    estado TEXT NOT NULL DEFAULT 'Pendiente de Firma' CHECK (estado IN ('Pendiente de Firma', 'En Revision', 'Aprovado')),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    archivo_adjunto TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE documentos_en_direccion ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own documents"
    ON documentos_en_direccion FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
    ON documentos_en_direccion FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
    ON documentos_en_direccion FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
    ON documentos_en_direccion FOR DELETE
    USING (auth.uid() = user_id);
