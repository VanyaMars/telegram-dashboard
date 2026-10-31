-- Personal OS 6.9.1. Additive schema ONLY: do not execute in production without permission.
create table if not exists public.os10_goal_documents (
 telegram_user_id bigint not null,
 goal_kind text not null check(goal_kind in ('regular','strategic')),
 goal_id uuid not null,
 fields jsonb not null default '[]'::jsonb check(jsonb_typeof(fields)='array'),
 closed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(telegram_user_id,goal_kind,goal_id)
);
create index if not exists os10_goal_documents_owner_idx on public.os10_goal_documents(telegram_user_id,updated_at desc);
alter table public.os10_goal_documents enable row level security;
revoke all on public.os10_goal_documents from anon,authenticated,public;
grant select,insert,update,delete on public.os10_goal_documents to service_role;
-- No public RLS policies: only verified Edge function + tenant-filtered service role.
-- Never DROP this table during frontend rollback: it can contain user data.
