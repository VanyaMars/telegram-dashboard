-- Personal OS 6.1 Premium UI | additive, idempotent migration.
-- Execute after Personal OS 6.0. NO DROP/TRUNCATE/DELETE of legacy user data.
create extension if not exists pgcrypto;

create table if not exists public.os61_categories (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 60),
  icon text not null default 'folder' check(length(icon) between 2 and 30),
  color text not null default '#8B84ED' check(color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists os61_categories_user_name_ci
  on public.os61_categories (telegram_user_id, lower(name));
create index if not exists os61_categories_user_order
  on public.os61_categories (telegram_user_id, sort_order, created_at);

alter table public.personal_tasks add column if not exists os61_category_id uuid
  references public.os61_categories(id) on delete set null;
alter table public.personal_tasks add column if not exists os61_position numeric(18,6);
create index if not exists personal_tasks_os61_sort
  on public.personal_tasks(telegram_user_id,day,priority,os61_position,id);

create table if not exists public.os61_preferences (
  telegram_user_id bigint primary key references public.profiles(telegram_user_id) on delete cascade,
  tz_initialized boolean not null default false,
  date_locale text not null default 'ru-RU',
  updated_at timestamptz not null default now()
);

-- Import all legacy sphere names as persistent categories.
insert into public.os61_categories(telegram_user_id,name,sort_order)
select telegram_user_id,trim(sphere),0
  from public.personal_tasks
  where nullif(trim(sphere),'') is not null
  group by telegram_user_id,trim(sphere)
on conflict do nothing;

-- Existing task/category links are backfilled, but task titles, days, completion,
-- historical KPI rows and goal history stay unchanged.
update public.personal_tasks as t
set os61_category_id = c.id
from public.os61_categories c
where t.telegram_user_id=c.telegram_user_id
  and lower(trim(t.sphere))=lower(c.name)
  and t.os61_category_id is null;

with numbered as (
  select id, row_number() over (
    partition by telegram_user_id,day,priority
    order by created_at,id
  ) * 1024 as position
  from public.personal_tasks where os61_position is null
)
update public.personal_tasks t set os61_position=n.position
from numbered n where t.id=n.id and t.os61_position is null;

-- Atomic category rename. The existing textual sphere is kept in sync so v5/v6,
-- webhook, and historical analytics still display a consistent category name.
create or replace function public.os61_rename_category(
  p_uid bigint,p_id uuid,p_name text,p_color text,p_icon text
) returns void language plpgsql security definer set search_path=public as $$
declare old_name text;
begin
  if length(trim(p_name)) not between 1 and 60
     or p_color !~ '^#[0-9A-Fa-f]{6}$' or length(p_icon) not between 2 and 30 then
    raise exception 'Invalid category fields';
  end if;
  select name into old_name from public.os61_categories
    where id=p_id and telegram_user_id=p_uid for update;
  if old_name is null then raise exception 'Category not found'; end if;
  update public.os61_categories set name=trim(p_name),color=p_color,icon=p_icon,updated_at=now()
    where id=p_id and telegram_user_id=p_uid;
  update public.personal_tasks set sphere=trim(p_name)
    where telegram_user_id=p_uid and (os61_category_id=p_id or (os61_category_id is null and sphere=old_name));
  update public.os6_repeats set sphere=trim(p_name)
    where telegram_user_id=p_uid and sphere=old_name;
end $$;

-- Deleting a category NEVER deletes user tasks or goal history.
create or replace function public.os61_remove_category(p_uid bigint,p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare old_name text;
begin
  select name into old_name from public.os61_categories where id=p_id and telegram_user_id=p_uid for update;
  if old_name is null then raise exception 'Category not found'; end if;
  update public.personal_tasks set os61_category_id=null,sphere='Без категории'
    where telegram_user_id=p_uid and (os61_category_id=p_id or (os61_category_id is null and sphere=old_name));
  update public.os6_repeats set sphere='Без категории' where telegram_user_id=p_uid and sphere=old_name;
  delete from public.os61_categories where id=p_id and telegram_user_id=p_uid;
end $$;

-- Atomic, owner-checked reorder across Important, Extra, and Buffer.
-- Called ONLY by the authenticated os61 Edge Function using the service-role key.
create or replace function public.os61_apply_task_order(p_uid bigint,p_items jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare rec record; v_day date; v_id uuid; v_count integer; n integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 400 then
    raise exception 'Invalid order payload';
  end if;
  if exists (
    select 1 from (
      select elem->>'id' as id,count(*) as c from jsonb_array_elements(p_items) elem
      group by elem->>'id' having count(*)>1
    ) duplicates
  ) then raise exception 'Duplicate task IDs'; end if;
  for rec in select value from jsonb_array_elements(p_items) loop
    n := n+1;
    if (rec.value->>'id') is null or (rec.value->>'priority') not in ('important','extra')
      or (rec.value->>'position') !~ '^[0-9]{1,9}$' then
       raise exception 'Invalid reorder item';
    end if;
    begin
      v_id := (rec.value->>'id')::uuid;
      v_day := nullif(rec.value->>'day','')::date;
    exception when others then raise exception 'Invalid ID or day'; end;
    if rec.value->>'day' is not null and v_day::text <> rec.value->>'day' then
      raise exception 'Invalid date';
    end if;
    update public.personal_tasks set
      day=v_day,
      priority=rec.value->>'priority',
      completed=case when v_day is null then false
        when day is distinct from v_day then false else completed end,
      os61_position=(rec.value->>'position')::numeric,
      updated_at=now()
    where id=v_id and telegram_user_id=p_uid;
    if not found then raise exception 'Task not found for this user'; end if;
  end loop;
end $$;

-- No direct anonymous or ordinary authenticated database permissions.
alter table public.os61_categories enable row level security;
alter table public.os61_preferences enable row level security;
revoke all on public.os61_categories from anon,authenticated;
revoke all on public.os61_preferences from anon,authenticated;
revoke all on function public.os61_apply_task_order(bigint,jsonb) from PUBLIC,anon,authenticated;
revoke all on function public.os61_rename_category(bigint,uuid,text,text,text) from PUBLIC,anon,authenticated;
revoke all on function public.os61_remove_category(bigint,uuid) from PUBLIC,anon,authenticated;
grant execute on function public.os61_apply_task_order(bigint,jsonb) to service_role;
grant execute on function public.os61_rename_category(bigint,uuid,text,text,text) to service_role;
grant execute on function public.os61_remove_category(bigint,uuid) to service_role;
