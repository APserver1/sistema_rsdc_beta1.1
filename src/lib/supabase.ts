import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xowyalayscvsbehlkxuc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvd3lhbGF5c2N2c2JlaGxreHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0MDkwNzEsImV4cCI6MjA1NTk4NTA3MX0.ntdvydxSOJYELIogeL6PCiG-hPsb9lZFJSbrqtU_r8s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
