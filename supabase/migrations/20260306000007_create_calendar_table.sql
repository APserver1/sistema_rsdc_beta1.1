-- Create the rsdc_calendar table for reminders and events
CREATE TABLE IF NOT EXISTS rsdc_calendar (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    fecha_evento TIMESTAMPTZ, -- For one-time events
    hora_recordatorio TIME,   -- For recurring daily events
    es_recurrente BOOLEAN DEFAULT false,
    patron_recurrencia TEXT DEFAULT 'none', -- 'none', 'daily'
    estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'notificado', 'completado'
    ultimo_aviso TIMESTAMPTZ, -- Last time the notification was sent
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE rsdc_calendar ENABLE ROW LEVEL SECURITY;

-- Policies for Calendar
CREATE POLICY "Users can view own calendar events" 
  ON rsdc_calendar FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar events" 
  ON rsdc_calendar FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events" 
  ON rsdc_calendar FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events" 
  ON rsdc_calendar FOR DELETE 
  USING (auth.uid() = user_id);
