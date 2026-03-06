-- Create a table to link Telegram chat IDs with system user IDs
CREATE TABLE IF NOT EXISTS rsdc_telegram_users (
    telegram_chat_id BIGINT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id) -- One system user per Telegram account (or vice versa for simplicity)
);

-- Add a column to store temporary linking codes in public_user
ALTER TABLE public_user ADD COLUMN IF NOT EXISTS telegram_link_code TEXT;
ALTER TABLE public_user ADD COLUMN IF NOT EXISTS telegram_link_expires TIMESTAMPTZ;

-- Enable RLS for the linking table
ALTER TABLE rsdc_telegram_users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own telegram link"
    ON rsdc_telegram_users FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own telegram link"
    ON rsdc_telegram_users FOR DELETE
    USING (auth.uid() = user_id);
