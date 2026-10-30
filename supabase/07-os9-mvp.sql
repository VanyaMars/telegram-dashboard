-- Personal OS 6.4: additive, non-destructive earnings attached to existing task IDs.
create table if not exists public.os9_task_income (
 telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
 task_id uuid not null, -- intentional: earned income is preserved if the task is removed
 amount numeric(14,2) not null default 0 check (amount between 0 and 999999999),
 currency text not null default 'RUB' check (currency in ('RUB','USD','EUR')),
 confirmed boolean not null default false,
 earned_on date,
 updated_at timestamptz not null default now(),
 primary key (telegram_user_id,task_id)
);
create index if not exists os9_income_date_idx on public.os9_task_income(telegram_user_id,earned_on)
 where confirmed = true;
alter table public.os9_task_income enable row level security;
revoke all on table public.os9_task_income from anon,authenticated;
-- Optional relationship: a task can contribute to one regular goal, independently
-- of the existing os6 ambitious goal relationship.
create table if not exists public.os9_regular_goal_tasks (
 telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
 task_id uuid not null references public.personal_tasks(id) on delete cascade,
 goal_id uuid not null,
 primary key(telegram_user_id,task_id),
 foreign key(telegram_user_id,goal_id) references public.os8_regular_goals(telegram_user_id,id) on delete cascade
);
create index if not exists os9_goal_links_goal_idx on public.os9_regular_goal_tasks(telegram_user_id,goal_id);
alter table public.os9_regular_goal_tasks enable row level security;
revoke all on public.os9_regular_goal_tasks from anon,authenticated;
create table if not exists public.os9_archived_goal_links (
 telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
 task_id uuid not null,
 goal_id uuid not null,
 primary key(telegram_user_id,task_id),
 foreign key(telegram_user_id,goal_id) references public.os8_regular_goals(telegram_user_id,id) on delete cascade
);
alter table public.os9_archived_goal_links enable row level security;
revoke all on public.os9_archived_goal_links from anon,authenticated;

-- Keep page blocks and Pipelines when a task is deleted, so Undo can recover them.
-- The previous os8_task_cleanup trigger destroyed linked content before restoration.
create table if not exists public.os9_task_page_archive (
 telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
 task_id uuid not null,
 page_id uuid not null,
 archived_at timestamptz not null default now(),
 primary key(telegram_user_id,task_id),
 unique(telegram_user_id,page_id),
 foreign key(telegram_user_id,page_id) references public.os7_pages(telegram_user_id,id) on delete cascade
);
alter table public.os9_task_page_archive enable row level security;
revoke all on table public.os9_task_page_archive from anon,authenticated;

drop trigger if exists os8_task_cleanup on public.personal_tasks;
create or replace function public.os9_archive_task_page() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.os9_task_page_archive(telegram_user_id,task_id,page_id)
 select telegram_user_id,task_id,page_id from public.os8_task_pages
 where telegram_user_id=old.telegram_user_id and task_id=old.id
 on conflict (telegram_user_id,task_id) do update set page_id=excluded.page_id, archived_at=now();
 insert into public.os9_archived_goal_links(telegram_user_id,task_id,goal_id)
 select telegram_user_id,task_id,goal_id from public.os9_regular_goal_tasks
 where telegram_user_id=old.telegram_user_id and task_id=old.id
 on conflict(telegram_user_id,task_id) do update set goal_id=excluded.goal_id;
 return old;
end $$;
drop trigger if exists os9_task_archive on public.personal_tasks;
create trigger os9_task_archive before delete on public.personal_tasks for each row execute function public.os9_archive_task_page();
-- Preserve the same page ID (and blocks) when Undo re-inserts the same task ID.
create or replace function public.os8_create_page_for_task() returns trigger language plpgsql security definer set search_path=public as $$
declare page_uuid uuid;
begin
 if exists(select 1 from public.os8_task_pages where telegram_user_id=new.telegram_user_id and task_id=new.id) then return new;end if;
 select a.page_id into page_uuid from public.os9_task_page_archive a
 join public.os7_pages p on p.telegram_user_id=a.telegram_user_id and p.id=a.page_id
 where a.telegram_user_id=new.telegram_user_id and a.task_id=new.id;
 if page_uuid is not null then
   insert into public.os8_task_pages(telegram_user_id,task_id,page_id) values(new.telegram_user_id,new.id,page_uuid);
   delete from public.os9_task_page_archive where telegram_user_id=new.telegram_user_id and task_id=new.id;
 else
   insert into public.os7_pages(telegram_user_id,title,icon) values(new.telegram_user_id,new.title,'📝') returning id into page_uuid;
   insert into public.os8_task_pages(telegram_user_id,task_id,page_id) values(new.telegram_user_id,new.id,page_uuid);
 end if;
 insert into public.os9_regular_goal_tasks(telegram_user_id,task_id,goal_id)
 select telegram_user_id,new.id,goal_id from public.os9_archived_goal_links
 where telegram_user_id=new.telegram_user_id and task_id=new.id
 on conflict(telegram_user_id,task_id) do update set goal_id=excluded.goal_id;
 delete from public.os9_archived_goal_links where telegram_user_id=new.telegram_user_id and task_id=new.id;
 return new;
end $$;
-- Pages from permanently removed tasks remain in the archive until an explicit
-- trash/retention policy is implemented. Do NOT garbage-collect without backup.
