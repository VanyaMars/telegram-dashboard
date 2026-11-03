-- Additive task editor migration. Rollback: revert frontend/Edge; retain additive columns/tables.
alter table public.personal_tasks add column if not exists task_options jsonb not null default '{}'::jsonb;
create table if not exists public.os12_task_trash(telegram_user_id bigint not null,task_id uuid not null,snapshot jsonb not null,primary key(telegram_user_id,task_id));
alter table public.os12_task_trash enable row level security;
revoke all on public.os12_task_trash from public,anon,authenticated;
create or replace function public.os12_capture_task() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 insert into os12_task_trash values(old.telegram_user_id,old.id,jsonb_build_object('task',to_jsonb(old),'properties',coalesce((select jsonb_agg(to_jsonb(v)) from os11_task_property_values v where v.telegram_user_id=old.telegram_user_id and v.task_id=old.id),'[]'::jsonb),'goal',(select goal_id from os6_task_goal where telegram_user_id=old.telegram_user_id and task_id=old.id))) on conflict(telegram_user_id,task_id) do update set snapshot=excluded.snapshot;
 return old;
end $$;
create or replace function public.os12_restore_task() returns trigger language plpgsql security invoker set search_path=public as $$
declare s jsonb; v jsonb;
begin
 select snapshot into s from os12_task_trash where telegram_user_id=new.telegram_user_id and task_id=new.id;
 if s is null then return new;end if;
 update personal_tasks set task_options=coalesce(s->'task'->'task_options','{}'::jsonb),os61_category_id=(select id from os61_categories where id=(s->'task'->>'os61_category_id')::uuid and telegram_user_id=new.telegram_user_id),os6_repeat_id=(select id from os6_repeats where id=(s->'task'->>'os6_repeat_id')::uuid and telegram_user_id=new.telegram_user_id),created_at=(s->'task'->>'created_at')::timestamptz,os61_position=(s->'task'->>'os61_position')::numeric where id=new.id and telegram_user_id=new.telegram_user_id;
 for v in select value from jsonb_array_elements(s->'properties') loop
  insert into os11_task_property_values(telegram_user_id,task_id,property_id,value) select new.telegram_user_id,new.id,(v->>'property_id')::uuid,v->>'value' where exists(select 1 from os11_task_property_definitions where telegram_user_id=new.telegram_user_id and id=(v->>'property_id')::uuid) on conflict do nothing;
 end loop;
 if s->>'goal' is not null then
 insert into os6_task_goal(telegram_user_id,task_id,goal_id) select new.telegram_user_id,new.id,(s->>'goal')::uuid where exists(select 1 from ambitious_goals where telegram_user_id=new.telegram_user_id and id=(s->>'goal')::uuid) on conflict do nothing;
 end if;
 delete from os12_task_trash where telegram_user_id=new.telegram_user_id and task_id=new.id;return new;
end $$;
create trigger os12_capture before delete on public.personal_tasks for each row execute function public.os12_capture_task();
create trigger os12_restore after insert on public.personal_tasks for each row execute function public.os12_restore_task();
revoke execute on function public.os12_capture_task(),public.os12_restore_task() from public,anon,authenticated;

create or replace function public.os12_duplicate_task(owner_id bigint,source_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$
declare t personal_tasks; new_task uuid; root_id uuid; generated_page uuid; mapping jsonb; old_page os7_pages; b os7_blocks; sp os7_splits; new_block uuid; new_split uuid; new_page uuid;
begin
 select * into t from personal_tasks where id=source_id and telegram_user_id=owner_id;
 if not found then raise exception 'Task not found';end if;
 insert into personal_tasks(telegram_user_id,title,notes,sphere,priority,day,completed,os61_category_id,task_options) values(owner_id,left(t.title,170)||' — копия',t.notes,t.sphere,t.priority,null,false,t.os61_category_id,t.task_options||'{"archived":false,"template":false,"deadline":null}'::jsonb) returning id into new_task;
 select page_id into generated_page from os8_task_pages where task_id=new_task and telegram_user_id=owner_id;
 select page_id into root_id from os8_task_pages where task_id=source_id and telegram_user_id=owner_id;
 insert into os11_task_property_values(telegram_user_id,task_id,property_id,value) select owner_id,new_task,property_id,value from os11_task_property_values where task_id=source_id and telegram_user_id=owner_id;
 insert into os6_task_goal(telegram_user_id,task_id,goal_id) select owner_id,new_task,goal_id from os6_task_goal where task_id=source_id and telegram_user_id=owner_id;
 insert into os9_regular_goal_tasks(telegram_user_id,task_id,goal_id) select owner_id,new_task,goal_id from os9_regular_goal_tasks where task_id=source_id and telegram_user_id=owner_id;
 insert into os9_task_income(telegram_user_id,task_id,amount,currency,confirmed,earned_on) select owner_id,new_task,amount,currency,false,null from os9_task_income where task_id=source_id and telegram_user_id=owner_id;
 if root_id is null then return new_task;end if;
 with recursive pages as(select id from os7_pages where id=root_id and telegram_user_id=owner_id union select p.id from os7_pages p join pages x on p.parent_id=x.id where p.telegram_user_id=owner_id) select jsonb_object_agg(id::text,gen_random_uuid()::text) into mapping from pages;
 for old_page in select * from os7_pages where telegram_user_id=owner_id and mapping ? id::text loop
 new_page=(mapping->>old_page.id::text)::uuid;
 insert into os7_pages(id,telegram_user_id,title,icon) values(new_page,owner_id,case when old_page.id=root_id then left(t.title,170)||' — копия' else old_page.title end,old_page.icon);
 end loop;
 for old_page in select * from os7_pages where telegram_user_id=owner_id and mapping ? id::text loop
 new_page=(mapping->>old_page.id::text)::uuid;
 update os7_pages set parent_id=(mapping->>old_page.parent_id::text)::uuid where id=new_page and telegram_user_id=owner_id;
 for b in select * from os7_blocks where page_id=old_page.id and telegram_user_id=owner_id loop
 insert into os7_blocks(telegram_user_id,page_id,type,position,content) values(owner_id,new_page,b.type,b.position,case when b.type='page_link' and mapping ? (b.content->>'pageId') then jsonb_set(b.content,'{pageId}',mapping->(b.content->>'pageId')) else replace(b.content::text,'"checked": true','"checked": false')::jsonb end) returning id into new_block;
 for sp in select * from os7_splits where block_id=b.id and telegram_user_id=owner_id loop
 insert into os7_splits(telegram_user_id,block_id,title,position) values(owner_id,new_block,sp.title,sp.position) returning id into new_split;
 insert into os7_workflow_items(telegram_user_id,split_id,title,completed,position) select owner_id,new_split,title,false,position from os7_workflow_items where split_id=sp.id and telegram_user_id=owner_id;
 end loop;end loop;end loop;
 update os8_task_pages set page_id=(mapping->>root_id::text)::uuid where task_id=new_task and telegram_user_id=owner_id;
 delete from os7_pages where id=generated_page and telegram_user_id=owner_id;

 return new_task;
end $$;
revoke execute on function public.os12_duplicate_task(bigint,uuid) from public,anon,authenticated;
grant execute on function public.os12_duplicate_task(bigint,uuid) to service_role;

grant all on public.os12_task_trash to service_role;
create or replace function public.os12_patch_task_options(owner_id bigint,task_id uuid,patch jsonb) returns jsonb language sql security invoker set search_path=public as $$
 update personal_tasks set task_options=task_options||patch,updated_at=now() where id=task_id and telegram_user_id=owner_id returning task_options;
$$;
revoke execute on function public.os12_patch_task_options(bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.os12_patch_task_options(bigint,uuid,jsonb) to service_role;

create or replace function public.os12_duplicate_split(owner_id bigint,source_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$
declare source os7_splits; created uuid;
begin
 select * into source from os7_splits where id=source_id and telegram_user_id=owner_id;
 if not found then raise exception 'Stage not found';end if;
 insert into os7_splits(telegram_user_id,block_id,title,position) select owner_id,source.block_id,source.title||' — копия',coalesce(max(position),0)+1000 from os7_splits where telegram_user_id=owner_id and block_id=source.block_id returning id into created;
 insert into os7_workflow_items(telegram_user_id,split_id,title,completed,position) select owner_id,created,title,false,position from os7_workflow_items where split_id=source_id and telegram_user_id=owner_id;
 return created;
end $$;
revoke execute on function public.os12_duplicate_split(bigint,uuid) from public,anon,authenticated;
grant execute on function public.os12_duplicate_split(bigint,uuid) to service_role;
