-- Personal OS 6.3: additive migration. Keep personal_tasks and ambitious_goals as sources of truth.
-- Requires os7 workspace tables from version 6.2.
create table if not exists public.os8_task_pages (
 telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
 task_id uuid not null references public.personal_tasks(id) on delete cascade,
 page_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(telegram_user_id,task_id),
 unique(telegram_user_id,page_id),
 foreign key (telegram_user_id,page_id) references public.os7_pages(telegram_user_id,id) on delete cascade
);
create index if not exists os8_task_pages_page_idx on public.os8_task_pages(telegram_user_id,page_id);
create table if not exists public.os8_regular_goals (
 id uuid primary key default gen_random_uuid(),
 telegram_user_id bigint not null references public.profiles(telegram_user_id) on delete cascade,
 title text not null check (char_length(title) between 1 and 180),
 description text not null default '' check(char_length(description)<=6000),
 period text not null default 'open' check (period in ('open','week','month','deadline')),
 starts_on date,
 ends_on date,
 progress integer not null default 0 check(progress between 0 and 100),
 completed boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (ends_on is null or starts_on is null or ends_on>=starts_on),
 unique(telegram_user_id,id)
);
create index if not exists os8_goals_owner_idx on public.os8_regular_goals(telegram_user_id,updated_at desc);
alter table public.os8_task_pages enable row level security;
alter table public.os8_regular_goals enable row level security;
revoke all on table public.os8_task_pages,public.os8_regular_goals from anon,authenticated;
-- We do not mass-create pages in migration: old tasks are linked lazily when opened,
-- avoiding duplicates and preserving the original task record, category, date, and state.

-- Deleting a task should also remove its linked page and all its page blocks.
create or replace function public.os8_delete_linked_page() returns trigger language plpgsql security definer set search_path=public as $$
begin
  delete from public.os7_pages where telegram_user_id=old.telegram_user_id and id in
   (select page_id from public.os8_task_pages where telegram_user_id=old.telegram_user_id and task_id=old.id);
  return old;
end; $$;
drop trigger if exists os8_task_cleanup on public.personal_tasks;
create trigger os8_task_cleanup before delete on public.personal_tasks for each row execute function public.os8_delete_linked_page();
-- Every new task receives its own page automatically, regardless of entry point
-- (Mini App, Telegram webhook, repeats), without changing personal_tasks.
create or replace function public.os8_create_page_for_task() returns trigger language plpgsql security definer set search_path=public as $$
declare page_uuid uuid;
begin
  if not exists(select 1 from public.os8_task_pages where telegram_user_id=new.telegram_user_id and task_id=new.id) then
    insert into public.os7_pages(telegram_user_id,title,icon)
      values(new.telegram_user_id,new.title,'📝') returning id into page_uuid;
    insert into public.os8_task_pages(telegram_user_id,task_id,page_id)
      values(new.telegram_user_id,new.id,page_uuid);
  end if;
  return new;
end $$;
drop trigger if exists os8_task_create on public.personal_tasks;
create trigger os8_task_create after insert on public.personal_tasks for each row execute function public.os8_create_page_for_task();

-- Keep the title consistent whether edited in an old task form or in the new page editor.
create or replace function public.os8_sync_task_title_to_page() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.os7_pages p set title=new.title,updated_at=now()
 from public.os8_task_pages l
 where l.telegram_user_id=new.telegram_user_id and l.task_id=new.id
  and p.telegram_user_id=l.telegram_user_id and p.id=l.page_id and p.title is distinct from new.title;
 return new;
end $$;
drop trigger if exists os8_task_rename on public.personal_tasks;
create trigger os8_task_rename after update of title on public.personal_tasks for each row
 when (old.title is distinct from new.title) execute function public.os8_sync_task_title_to_page();
create or replace function public.os8_sync_page_title_to_task() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.personal_tasks t set title=new.title
 from public.os8_task_pages l
 where l.telegram_user_id=new.telegram_user_id and l.page_id=new.id
  and t.telegram_user_id=l.telegram_user_id and t.id=l.task_id and t.title is distinct from new.title;
 return new;
end $$;
drop trigger if exists os8_page_rename on public.os7_pages;
create trigger os8_page_rename after update of title on public.os7_pages for each row
 when (old.title is distinct from new.title) execute function public.os8_sync_page_title_to_task();

-- Backfill existing tasks without touching their properties or completion state.
do $$ declare existing record; new_page uuid; begin
 for existing in
  select t.telegram_user_id,t.id,t.title from public.personal_tasks t
  where not exists (select 1 from public.os8_task_pages l
    where l.telegram_user_id=t.telegram_user_id and l.task_id=t.id)
 loop
   insert into public.os7_pages(telegram_user_id,title,icon)
   values(existing.telegram_user_id,existing.title,'📝') returning id into new_page;
   insert into public.os8_task_pages(telegram_user_id,task_id,page_id)
   values(existing.telegram_user_id,existing.id,new_page) on conflict do nothing;
 end loop;
end $$;
