-- Personal OS Workspace / Notion-like pages, additive only. Run on existing Supabase.
-- The established profiles, tasks, goals, and Edge Functions are not modified.
create extension if not exists pgcrypto;

create table if not exists public.os7_pages (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
  parent_id uuid null,
  title text not null default 'Без названия' check (char_length(title) <= 180),
  icon text not null default '📄' check (char_length(icon) <= 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(telegram_user_id,id),
  foreign key(telegram_user_id,parent_id) references public.os7_pages(telegram_user_id,id) on delete cascade,
  check (parent_id is null or parent_id <> id)
);
create index if not exists os7_pages_parent_idx on public.os7_pages(telegram_user_id,parent_id,updated_at desc);

create table if not exists public.os7_blocks (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  page_id uuid not null,
  type text not null check(type in ('text','heading','checklist','image','divider','database','pipeline','page_link')),
  position integer not null default 100 check(position >= 0),
  content jsonb not null default '{}'::jsonb check(jsonb_typeof(content)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(telegram_user_id,id),
  foreign key(telegram_user_id,page_id) references public.os7_pages(telegram_user_id,id) on delete cascade
);
create index if not exists os7_blocks_page_idx on public.os7_blocks(telegram_user_id,page_id,position,id);

create table if not exists public.os7_data_sources (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
  name text not null check(char_length(name) between 1 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(telegram_user_id,id)
);
create index if not exists os7_sources_owner_idx on public.os7_data_sources(telegram_user_id,updated_at desc);

create table if not exists public.os7_fields (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  source_id uuid not null,
  name text not null check(char_length(name) between 1 and 80),
  field_type text not null check(field_type in ('text','number','status','date','checkbox','select','relation')),
  options jsonb not null default '{}'::jsonb check(jsonb_typeof(options)='object'),
  position integer not null default 100 check(position >= 0),
  created_at timestamptz not null default now(),
  unique(telegram_user_id,id),
  foreign key(telegram_user_id,source_id) references public.os7_data_sources(telegram_user_id,id) on delete cascade
);
create index if not exists os7_fields_idx on public.os7_fields(telegram_user_id,source_id,position);

create table if not exists public.os7_records (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  source_id uuid not null,
  page_id uuid not null,
  title text not null default 'Новая запись' check (char_length(title) <= 180),
  properties jsonb not null default '{}'::jsonb check(jsonb_typeof(properties)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(telegram_user_id,id),
  unique(telegram_user_id,page_id),
  foreign key(telegram_user_id,source_id) references public.os7_data_sources(telegram_user_id,id) on delete cascade,
  foreign key(telegram_user_id,page_id) references public.os7_pages(telegram_user_id,id) on delete cascade
);
create index if not exists os7_records_idx on public.os7_records(telegram_user_id,source_id,created_at desc);

create table if not exists public.os7_views (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  source_id uuid not null,
  name text not null check(char_length(name) between 1 and 80),
  view_type text not null check(view_type in ('table','board','list','calendar')),
  config jsonb not null default '{}'::jsonb check(jsonb_typeof(config)='object'),
  position integer not null default 100 check(position >= 0),
  created_at timestamptz not null default now(),
  unique(telegram_user_id,id),
  foreign key(telegram_user_id,source_id) references public.os7_data_sources(telegram_user_id,id) on delete cascade
);
create index if not exists os7_views_idx on public.os7_views(telegram_user_id,source_id,position);

create table if not exists public.os7_splits (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  block_id uuid not null,
  title text not null check(char_length(title) between 1 and 120),
  position integer not null default 100 check(position >= 0),
  created_at timestamptz not null default now(),
  unique(telegram_user_id,id),
  foreign key(telegram_user_id,block_id) references public.os7_blocks(telegram_user_id,id) on delete cascade
);
create index if not exists os7_splits_idx on public.os7_splits(telegram_user_id,block_id,position);

create table if not exists public.os7_workflow_items (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  split_id uuid not null,
  title text not null check(char_length(title) between 1 and 240),
  completed boolean not null default false,
  position integer not null default 100 check(position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(telegram_user_id,id),
  foreign key(telegram_user_id,split_id) references public.os7_splits(telegram_user_id,id) on delete cascade
);
create index if not exists os7_workflow_idx on public.os7_workflow_items(telegram_user_id,split_id,position);

-- The existing frontend authenticates via Telegram initData; all user operations
-- happen through the server's verified Edge Function. Block direct anon access.
do $$ declare t text; begin
  foreach t in array array['os7_pages','os7_blocks','os7_data_sources','os7_fields','os7_records','os7_views','os7_splits','os7_workflow_items'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
  end loop;
end $$;