-- Daily Perimenopause Diary: one person's rows, daily entries, comments and feedback.
-- Every table is locked to its owner with row-level security.

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- The rows a person tracks. CeMCOR's standard rows are copied in on first sign-in;
-- custom rows and treatments are added by the person.
create table public.diary_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text,                -- stable id for CeMCOR standard rows, null for custom rows
  label text not null,
  scale text not null check (scale in ('0-4', 'count', 'MLUYZ', 'tick', 'number')),
  sort integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

-- One value per person, day and row. No row means "not recorded", which is
-- different from a recorded 0.
create table public.entries (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  row_id uuid not null references public.diary_rows on delete cascade,
  value text not null,
  entered_at timestamptz not null default now(),
  primary key (user_id, date, row_id)
);

create table public.day_comments (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  text text not null,
  entered_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  message text not null,
  device text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.diary_rows enable row level security;
alter table public.entries enable row level security;
alter table public.day_comments enable row level security;
alter table public.feedback enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.diary_rows
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own entries" on public.entries
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own comments" on public.day_comments
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Feedback can be sent but not read back from the app.
create policy "send feedback" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());

create index entries_user_date on public.entries (user_id, date);
