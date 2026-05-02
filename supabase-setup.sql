-- ============================================================
-- CASTRO AGENCY HUB — Supabase Setup
-- Run this entire script in your Supabase SQL editor
-- ============================================================

-- PROFILES TABLE
create table if not exists profiles (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  name text not null,
  role text not null default 'member',
  title text not null,
  ini text not null,
  created_at timestamp with time zone default now()
);

-- TASKS TABLE
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  uid uuid references profiles(id) on delete cascade,
  title text not null,
  note text default '',
  pri text not null default 'Normal',
  done boolean default false,
  rolled boolean default false,
  created_at timestamp with time zone default now()
);

-- REFERRALS TABLE
create table if not exists referrals (
  id uuid default gen_random_uuid() primary key,
  referred_by text not null,
  prospect text not null,
  phone text default '',
  status text not null default 'New Lead',
  created_at timestamp with time zone default now()
);

-- REVIEWS TABLE
create table if not exists reviews (
  id uuid default gen_random_uuid() primary key,
  client text not null,
  policy_type text default 'Auto',
  trigger_type text default 'New Policy',
  method text default 'Text',
  result text default 'Pending',
  asked_by_name text,
  asked_by_uid uuid references profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- SALES TABLE
create table if not exists sales (
  id uuid default gen_random_uuid() primary key,
  uid uuid references profiles(id) on delete cascade,
  client text not null,
  policy_type text default 'Auto',
  premium numeric default 0,
  created_at timestamp with time zone default now()
);

-- ACTIVITIES TABLE
create table if not exists activities (
  id uuid default gen_random_uuid() primary key,
  uid uuid references profiles(id) on delete cascade,
  type text not null,
  count integer not null default 0,
  notes text default '',
  created_at timestamp with time zone default now()
);

-- GOALS TABLE
create table if not exists goals (
  id uuid default gen_random_uuid() primary key,
  uid uuid references profiles(id) on delete cascade unique,
  policies integer default 8,
  calls integer default 100,
  quotes integer default 30,
  premium numeric default 10000,
  updated_at timestamp with time zone default now()
);

-- MESSAGES TABLE
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  uid uuid references profiles(id) on delete cascade,
  text text not null,
  created_at timestamp with time zone default now()
);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
alter table profiles   enable row level security;
alter table tasks      enable row level security;
alter table referrals  enable row level security;
alter table reviews    enable row level security;
alter table sales      enable row level security;
alter table activities enable row level security;
alter table goals      enable row level security;
alter table messages   enable row level security;

-- ============================================================
-- RLS POLICIES (all authenticated users can read/write)
-- ============================================================
create policy "Allow all for auth users" on profiles   for all using (auth.role() = 'authenticated');
create policy "Allow all for auth users" on tasks      for all using (auth.role() = 'authenticated');
create policy "Allow all for auth users" on referrals  for all using (auth.role() = 'authenticated');
create policy "Allow all for auth users" on reviews    for all using (auth.role() = 'authenticated');
create policy "Allow all for auth users" on sales      for all using (auth.role() = 'authenticated');
create policy "Allow all for auth users" on activities for all using (auth.role() = 'authenticated');
create policy "Allow all for auth users" on goals      for all using (auth.role() = 'authenticated');
create policy "Allow all for auth users" on messages   for all using (auth.role() = 'authenticated');

-- ============================================================
-- ENABLE REAL-TIME (for chat)
-- ============================================================
alter publication supabase_realtime add table messages;

-- ============================================================
-- INSERT TEAM PROFILES
-- !! REPLACE EACH EMAIL BELOW WITH THE REAL EMAIL FOR EACH PERSON !!
-- !! USE THE SAME EMAILS YOU CREATE IN SUPABASE AUTH (next step) !!
-- ============================================================
insert into profiles (email, name, role, title, ini) values
  ('luiscastro@allstate.com',    'Luis',    'admin',  'Owner',          'LU'),
  ('luiscastrojr@allstate.com',      'Jr',      'admin',  'Office Manager', 'JR'),
  ('juanymorales12@allstate.com',   'Juana',   'member', 'Agent',          'JN'),
  ('aishawatson@allstate.com',   'Aisha',   'member', 'Agent',          'AI'),
  ('tnavalopez@allstate.com',   'Tania',   'member', 'Agent',          'TA'),
  ('evelynortega1@allstate.com',  'Evelyn',  'member', 'Agent',          'EV'),
  ('dgoodwin8@allstate.com', 'Destiny', 'member', 'Agent',          'DE');
