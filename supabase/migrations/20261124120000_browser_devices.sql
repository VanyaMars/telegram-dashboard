create table if not exists public.prodesk_browser_devices (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null check (telegram_user_id > 0),
  device_key text not null check (device_key ~ '^[A-Za-z0-9_-]{122}$'),
  challenge text check (challenge ~ '^[A-Za-z0-9_-]{43}$'),
  challenge_expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.prodesk_browser_devices enable row level security;
revoke all on public.prodesk_browser_devices from public, anon, authenticated;
grant select, insert, update, delete on public.prodesk_browser_devices to service_role;

create or replace function public.prodesk_browser_device_challenge(p_id uuid, p_challenge text)
returns text
language sql
set search_path = ''
as $$
  update public.prodesk_browser_devices
  set challenge = case when challenge_expires_at > now() then challenge else p_challenge end,
      challenge_expires_at = case when challenge_expires_at > now() then challenge_expires_at else now() + interval '1 minute' end
  where id = p_id
  returning challenge;
$$;

revoke all on function public.prodesk_browser_device_challenge(uuid, text) from public, anon, authenticated;
grant execute on function public.prodesk_browser_device_challenge(uuid, text) to service_role;
