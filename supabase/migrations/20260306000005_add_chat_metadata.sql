-- Add metadata support for AI chats
alter table rsdc_ai_chat add column if not exists metadata jsonb default '{}'::jsonb;

-- Update RLS for safety (already enabled, just making sure)
alter table rsdc_ai_chat enable row level security;
