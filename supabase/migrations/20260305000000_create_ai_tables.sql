create table if not exists rsdc_ai_memory (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  titulo text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

create table if not exists rsdc_ai_chat (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  conversacion jsonb default '[]'::jsonb,
  ultima_vez_usado timestamptz default now(),
  created_at timestamptz default now()
);

-- Enable RLS
alter table rsdc_ai_memory enable row level security;
alter table rsdc_ai_chat enable row level security;

-- Policies for Memory
create policy "Users can view own memories" 
  on rsdc_ai_memory for select 
  using (auth.uid() = user_id);

create policy "Users can insert own memories" 
  on rsdc_ai_memory for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own memories" 
  on rsdc_ai_memory for update 
  using (auth.uid() = user_id);

create policy "Users can delete own memories" 
  on rsdc_ai_memory for delete 
  using (auth.uid() = user_id);

-- Policies for Chat
create policy "Users can view own chats" 
  on rsdc_ai_chat for select 
  using (auth.uid() = user_id);

create policy "Users can insert own chats" 
  on rsdc_ai_chat for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own chats" 
  on rsdc_ai_chat for update 
  using (auth.uid() = user_id);

create policy "Users can delete own chats" 
  on rsdc_ai_chat for delete 
  using (auth.uid() = user_id);
