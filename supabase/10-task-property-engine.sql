-- Personal OS: Coda/Notion-style task properties. Additive; do not apply to production without approval.
-- Existing task/page IDs and goals are preserved. Telegram ownership is enforced by the Edge API.
create table if not exists public.os11_task_property_definitions (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
  slug text,
  name text not null check (char_length(name) between 1 and 80),
  field_type text not null check (field_type in ('duration','number','text','checkbox','date','select')),
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options)='object'),
  position integer not null default 100,
  created_at timestamptz not null default now(),
  unique(telegram_user_id,id),
  unique(telegram_user_id,slug)
);
create index if not exists os11_task_property_owner_idx on public.os11_task_property_definitions(telegram_user_id,position,created_at);
create table if not exists public.os11_task_property_values (
  telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
  task_id uuid not null references public.personal_tasks(id) on delete cascade,
  property_id uuid not null,
  value text not null default '',
  updated_at timestamptz not null default now(),
  primary key(telegram_user_id,task_id,property_id),
  foreign key (telegram_user_id,property_id)
    references public.os11_task_property_definitions(telegram_user_id,id) on delete cascade,
  check (char_length(value)<=2000)
);
create index if not exists os11_property_aggregate_idx on public.os11_task_property_values(telegram_user_id,property_id,task_id);
create table if not exists public.os11_goal_rollups (
  telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
  goal_kind text not null check(goal_kind in ('regular','strategic')),
  goal_id uuid not null,
  property_id uuid not null,
  label text not null check(char_length(label) between 1 and 80),
  target numeric(16,2) check(target>0),
  updated_at timestamptz not null default now(),
  primary key(telegram_user_id,goal_kind,goal_id,property_id),
  foreign key(telegram_user_id,property_id) references public.os11_task_property_definitions(telegram_user_id,id) on delete cascade
);
alter table public.os11_goal_rollups enable row level security;
revoke all on public.os11_goal_rollups from anon,authenticated;
alter table public.os11_task_property_definitions enable row level security;
alter table public.os11_task_property_values enable row level security;
revoke all on public.os11_task_property_definitions,public.os11_task_property_values from anon,authenticated;
-- Authenticated Telegram requests go through server-side HMAC verification; no direct client grants.
-- Rollback (only after exporting values): DROP TABLE os11_task_property_values; DROP TABLE os11_task_property_definitions;
