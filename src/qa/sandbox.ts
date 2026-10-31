import type {Task,Goal,GoalPoint,Category,OS6Data,DayMetrics,Finance,Workout,BodyWeight,Repeat,Challenge,Focus} from '../types';
import type {RegularGoal} from '../components/RegularGoals';
import type {GoalField} from '../lib/goalDocument';
import type {WPage,WBlock,WSplit,WItem,WSource,WField,WView,WRecord} from '../lib/workspace';
import type {TaskIncome} from '../lib/earnings';
import {demoTasks,demoGoals,demoCategories,demoOS6,demoGoalHistory} from '../lib/demo';
import {dateInZone,initialTimezone,mondayOf,dateAdd} from '../lib/date';

// Standalone QA transport: intentionally no import from production API.
// The guest name is NOT an authentication factor; the entire state is local-only.
const SESSION_KEY='personal-os:qa:session:v1';
const DATA_PREFIX='personal-os:qa:data:v1:';
export type QASession={id:string;name:string;createdAt:string};
export const isQAMode=()=>new URLSearchParams(window.location.search).get('qa')==='1';
export function readQASession():QASession|null{
 try{const raw=localStorage.getItem(SESSION_KEY);if(!raw)return null;const s=JSON.parse(raw) as QASession;
  return typeof s.id==='string'&&/^[0-9a-f-]{36}$/.test(s.id)&&typeof s.name==='string'&&s.name.length>=2?s:null;
 }catch{return null}
}
export function startQASession(name:string):QASession{
 const session={id:crypto.randomUUID(),name:name.trim().slice(0,60),createdAt:new Date().toISOString()};
 localStorage.setItem(SESSION_KEY,JSON.stringify(session));return session;
}
export function clearQASession(){localStorage.removeItem(SESSION_KEY)}
export function resetQAData(){const s=readQASession();if(s)localStorage.removeItem(DATA_PREFIX+s.id)}

type QAState={
 tasks:Task[];goals:Goal[];history:GoalPoint[];categories:Category[];os6:OS6Data;
 regularGoals:RegularGoal[];regularLinks:Record<string,string>;incomes:Record<string,TaskIncome>;
 goalDocuments?:Record<string,{goal_kind:'regular'|'strategic';goal_id:string;fields:GoalField[];closed_at:string|null}>;
 pages:WPage[];blocks:WBlock[];splits:WSplit[];items:WItem[];
 sources:WSource[];fields:WField[];views:WView[];records:WRecord[];
 taskPages:Record<string,string>;trash:Record<string,Task>;
};
const now=()=>new Date().toISOString();
const newId=()=>crypto.randomUUID();
const dayToday=()=>dateInZone(new Date(),initialTimezone());
const keyFor=(s:QASession)=>DATA_PREFIX+s.id;
const asStr=(v:unknown)=>typeof v==='string'?v:'';
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const ok=(x:Record<string,unknown>={})=>({ok:true,...x});
function seed():QAState{
 const today=dayToday();
 const tasks=copy(demoTasks).map(t=>({...t,id:newId(),day:t.day?today:null}));
 const goals=copy(demoGoals).map(g=>({...g,id:newId(),created_at:now()}));
 const history=copy(demoGoalHistory).map(h=>({...h,goal_id:goals[0].id}));
 const os6=copy(demoOS6);
 os6.settings.tz=initialTimezone();
 os6.links=[{task_id:tasks[2].id,goal_id:goals[0].id}];
 os6.focus=[];os6.challenges=[{id:newId(),title:'7 дней фокуса',starts_on:dateAdd(today,-2),ends_on:dateAdd(today,4),target_days:7,note:''}];
 os6.challengeDays=[{challenge_id:os6.challenges[0].id,day:today}];
 const pageId=newId(),pipelineId=newId(),splitA=newId(),splitB=newId(),sourceId=newId();
 const pages:WPage[]=[{id:pageId,parent_id:null,title:'🚀 Запуск проекта',icon:'🚀',updated_at:now()}];
 const blocks:WBlock[]=[
  {id:newId(),page_id:pageId,type:'text',position:1000,content:{text:'Это тестовая страница. Все изменения доступны только в этом браузере.'}},
  {id:newId(),page_id:pageId,type:'checklist',position:2000,content:{text:'Проверить чеклист и Enter',checked:false}},
  {id:newId(),page_id:pageId,type:'checklist',position:3000,content:{text:'Проверить сохранение после перезагрузки',checked:true}},
  {id:pipelineId,page_id:pageId,type:'pipeline',position:4000,content:{title:'Pipeline'}},
  {id:newId(),page_id:pageId,type:'database',position:5000,content:{sourceId}}
 ];
 const splits:WSplit[]=[{id:splitA,block_id:pipelineId,title:'Планирование',position:1000},{id:splitB,block_id:pipelineId,title:'Разработка',position:2000}];
 const items:WItem[]=[{id:newId(),split_id:splitA,title:'Разбить работу на задачи',completed:true,position:1000},{id:newId(),split_id:splitA,title:'Подготовить макеты',completed:false,position:2000},{id:newId(),split_id:splitB,title:'Проверить мобильную версию',completed:false,position:1000}];
 const fields:WField[]=[{id:newId(),source_id:sourceId,name:'Статус',field_type:'status',options:{choices:['К работе','В процессе','Готово']},position:1000},{id:newId(),source_id:sourceId,name:'Дата',field_type:'date',options:{},position:2000}];
 const views:WView[]=['table','board','list','calendar'].map((v,i)=>({id:newId(),source_id:sourceId,name:({table:'Таблица',board:'Доска',list:'Список',calendar:'Календарь'} as Record<string,string>)[v],view_type:v as WView['view_type'],config:{},position:(i+1)*1000}));
 const regularGoals:RegularGoal[]=[{id:newId(),title:'Собрать работающий MVP',description:'Пример связанной с задачами цели',period:'open',starts_on:null,ends_on:null,progress:20,completed:false,created_at:now(),updated_at:now()}];
 return {tasks,goals,history,categories:copy(demoCategories),os6,regularGoals,regularLinks:{[tasks[0].id]:regularGoals[0].id,[tasks[1].id]:regularGoals[0].id},incomes:{},goalDocuments:{},
 pages,blocks,splits,items,sources:[{id:sourceId,name:'Тестовые проекты',updated_at:now()}],fields,views,records:[],taskPages:{[tasks[6].id]:pageId},trash:{}};
}
function load():QAState{
 const s=readQASession();if(!isQAMode()||!s)throw new Error('QA Sandbox: сначала создай гостевую сессию');
 const k=keyFor(s);const raw=localStorage.getItem(k);
 if(raw){try{const data=JSON.parse(raw) as QAState;if(Array.isArray(data.tasks)&&Array.isArray(data.pages)&&Array.isArray(data.regularGoals)){data.goalDocuments||={};return data}}catch{/* corrupted local sample */}}
 const initial=seed();localStorage.setItem(k,JSON.stringify(initial));return initial;
}
function persist(data:QAState){
 const s=readQASession();if(!s)throw Error('QA-сессия завершена');
 try{localStorage.setItem(keyFor(s),JSON.stringify(data))}catch{throw new Error('Тестовое хранилище браузера заполнено или недоступно')}
}
function dayMetrics(db:QAState,start:string,end:string):Record<string,DayMetrics>{
 const result:Record<string,DayMetrics>={};const dateStart=Date.parse(start+'T12:00:00Z');
 const dateEnd=Date.parse(end+'T12:00:00Z');if(!Number.isFinite(dateStart)||!Number.isFinite(dateEnd))return result;
 for(let stamp=dateStart;stamp<=dateEnd&&Object.keys(result).length<120;stamp+=86400000){
  const date=new Date(stamp).toISOString().slice(0,10);
  const tasks=db.tasks.filter(t=>t.day===date);
  result[date]={tasks:tasks.filter(t=>t.completed).length,sales:db.os6.finance.filter(f=>f.day===date&&f.is_sale&&f.direction==='income').length,sport:db.os6.workouts.filter(w=>w.day===date).length,
   important:tasks.filter(t=>t.priority==='important').length,extras:tasks.filter(t=>t.priority==='extra').length,done_important:tasks.filter(t=>t.priority==='important'&&t.completed).length,done_extras:tasks.filter(t=>t.priority==='extra'&&t.completed).length};
 }
 return result;
}
function ordered<T extends {position:number}>(items:T[]):T[]{return [...items].sort((a,b)=>a.position-b.position)}
function reorder<T extends {id:string;position:number}>(rows:T[],ids:string[]){
 const listed=new Set(ids);if(ids.length!==listed.size||!ids.every(id=>rows.some(x=>x.id===id))||ids.length!==rows.length)throw Error('Недопустимый порядок');
 ids.forEach((id,i)=>{const row=rows.find(x=>x.id===id);if(row)row.position=(i+1)*1000});
}
function nextPos<T extends {position:number}>(rows:T[]){return Math.max(0,...rows.map(x=>x.position))+1000}
function removePage(db:QAState,id:string){
 const children=db.pages.filter(x=>x.parent_id===id);children.forEach(x=>removePage(db,x.id));
 const blocks=db.blocks.filter(b=>b.page_id===id),pids=blocks.filter(b=>b.type==='pipeline').map(b=>b.id);
 const sids=db.splits.filter(x=>pids.includes(x.block_id)).map(x=>x.id);
 db.items=db.items.filter(x=>!sids.includes(x.split_id));db.splits=db.splits.filter(x=>!pids.includes(x.block_id));
 db.blocks=db.blocks.filter(b=>b.page_id!==id);db.pages=db.pages.filter(p=>p.id!==id);
 db.records=db.records.filter(r=>r.page_id!==id);
 for(const [taskId,pageId] of Object.entries(db.taskPages))if(pageId===id)delete db.taskPages[taskId];
}
function metricsDefault(db:QAState,fieldStart:string,fieldEnd:string){return {days:dayMetrics(db,fieldStart,fieldEnd)}}
function mutate(db:QAState,fn:string,action:string,f:Record<string,unknown>):Record<string,unknown>{
 const id=asStr(f.id),taskId=asStr(f.taskId);
 if(fn==='dashboard'){
  if(action==='read')return ok({days:[]});
  if(action==='tasks_list')return ok({daily:ordered(db.tasks.filter(t=>t.day===f.day).map(t=>({...t,position:t.os61_position??0})) as Array<Task & {position:number}>),buffer:db.tasks.filter(t=>t.day===null)});
  if(action==='goals_list')return ok({goals:db.goals,history:db.history});
  if(action==='task_toggle'){const t=db.tasks.find(t=>t.id===id);if(!t||!t.day)throw Error('Задача дня не найдена');t.completed=f.completed===true;return ok()}
  if(action==='task_delete'){const task=db.tasks.find(t=>t.id===id);if(!task)throw Error('Задача не найдена');db.trash[id]=copy(task);db.tasks=db.tasks.filter(t=>t.id!==id);return ok()}
  if(action==='task_restore'){const old=db.trash[id];if(!old)throw Error('Удалённая задача не найдена');db.tasks.push({...old,...(f.task as object),completed:f.completed===true});delete db.trash[id];return ok()}
  if(action==='goal_save'){const data=f.goal as Record<string,any>;if(!data)throw Error('Нет данных цели');const old=db.goals.find(g=>g.id===id);const next={...(old||{}),...data,id:old?.id||newId(),created_at:old?.created_at||now(),updated_at:now()} as Goal;db.goals=old?db.goals.map(g=>g.id===id?next:g):[...db.goals,next];db.history.push({id:db.history.length+1,goal_id:next.id,value:Number(next.current_value),recorded_at:dayToday()});return ok({id:next.id})}
  if(action==='goal_delete'){db.goals=db.goals.filter(g=>g.id!==id);db.history=db.history.filter(x=>x.goal_id!==id);db.os6.links=db.os6.links.filter(x=>x.goal_id!==id);return ok()}
 }
 if(fn==='os61'){
  if(action==='bootstrap')return ok({tz:db.os6.settings.tz,today:dateInZone(new Date(),db.os6.settings.tz),categories:ordered(db.categories.map(x=>({...x,position:x.sort_order})))});
  if(action==='task_category_set'){const t=db.tasks.find(x=>x.id===id);if(t){t.os61_category_id=f.categoryId?asStr(f.categoryId):null;const cat=db.categories.find(c=>c.id===t.os61_category_id);if(cat)t.sphere=cat.name;}return ok()}
  if(action==='task_reorder'){for(const r of (f.items as Array<{id:string;day:string|null;priority:Task['priority'];position:number}>)||[]){const t=db.tasks.find(x=>x.id===r.id);if(t){t.day=r.day;t.priority=r.priority;t.os61_position=r.position;}}return ok()}
  if(action==='category_save'){const old=db.categories.find(x=>x.id===id);const c={id:old?.id||newId(),name:asStr(f.name),color:asStr(f.color)||'#8B84ED',icon:asStr(f.icon)||'folder',sort_order:old?.sort_order??(db.categories.length+1)*100};db.categories=old?db.categories.map(x=>x.id===id?c:x):[...db.categories,c];return ok({id:c.id})}
  if(action==='category_delete'){db.categories=db.categories.filter(c=>c.id!==id);db.tasks.forEach(t=>{if(t.os61_category_id===id)t.os61_category_id=null});return ok()}
  if(action==='category_reorder'){(f.ids as string[]||[]).forEach((v,i)=>{const c=db.categories.find(x=>x.id===v);if(c)c.sort_order=(i+1)*100});return ok()}
  if(action==='challenge_day'){const k=asStr(f.id),day=asStr(f.day);db.os6.challengeDays=db.os6.challengeDays.filter(x=>!(x.challenge_id===k&&x.day===day));if(f.done===true)db.os6.challengeDays.push({challenge_id:k,day});return ok()}
  if(action==='timezone_save'){db.os6.settings.tz=asStr(f.tz)||initialTimezone();return ok()}
 }
 if(fn==='os6'){
  if(action==='bootstrap')return ok({...db.os6});
  if(action==='metrics')return ok(metricsDefault(db,asStr(f.start),asStr(f.end)));
  if(action==='calendar')return ok({tasks:db.tasks.filter(t=>t.day&&t.day>=asStr(f.start)&&t.day<=asStr(f.end))});
  if(action==='task_reschedule'){const task=db.tasks.find(t=>t.id===id);if(!task)throw Error('Задача не найдена');task.day=asStr(f.day)||null;task.completed=false;return ok()}
   if(action==='task_save_and_link'){
   const task=f.task as Partial<Task>;if(!task||!asStr(task.title).trim())throw Error('Укажи название задачи');
   const old=db.tasks.find(t=>t.id===id);
   const next:Task={...(old||{}),id:old?.id||newId(),title:asStr(task.title).trim(),notes:asStr(task.notes),sphere:asStr(task.sphere)||'Личное',day:task.day||null,priority:task.priority||'extra',completed:old?.completed||false,os61_category_id:old?.os61_category_id||null,os61_position:old?.os61_position||((db.tasks.length+1)*1024)};
   db.tasks=old?db.tasks.map(t=>t.id===old.id?next:t):[...db.tasks,next];
   db.os6.links=db.os6.links.filter(x=>x.task_id!==next.id);if(f.goal_id)db.os6.links.push({task_id:next.id,goal_id:asStr(f.goal_id)});
   return ok({id:next.id});
  }
  if(action==='focus'){
   const command=asStr(f.command),active=db.os6.focus.find(x=>x.state!=='finished');
   if(command==='start'&&!active){db.os6.focus.unshift({id:newId(),title:asStr(f.title)||'Фокус',task_id:asStr(f.task_id)||null,started_at:now(),accumulated_seconds:0,state:'running'});return ok()}
   if(active){const seconds=active.state==='running'&&active.started_at?Math.max(0,Math.floor((Date.now()-Date.parse(active.started_at))/1000)):0;
    if(command==='pause'){active.accumulated_seconds+=seconds;active.state='paused';active.started_at=null;}
    if(command==='resume'){active.state='running';active.started_at=now();}
    if(command==='stop'){active.accumulated_seconds+=seconds;active.state='finished';active.finished_at=now();active.started_at=null;}
   }return ok();
  }
  if(action==='settings_save'){db.os6.settings={...db.os6.settings,...(f.record as object)};return ok()}
  if(action==='review_save'){const monday=asStr(f.monday),record={monday,wins:asStr(f.wins),lessons:asStr(f.lessons),next_steps:asStr(f.next_steps)};db.os6.reviews=db.os6.reviews.filter(x=>x.monday!==monday).concat(record);return ok()}
  if(action==='entity_save'){
   const key=asStr(f.entity) as 'finance'|'workouts'|'weight'|'exercises'|'repeats'|'challenges';
   const map:Record<string, keyof Pick<OS6Data,'finance'|'workouts'|'weight'|'exercises'|'repeats'|'challenges'>>={finance:'finance',workout:'workouts',weight:'weight',exercise:'exercises',repeat:'repeats',challenge:'challenges'};
   const k=map[key];if(!k)throw Error('Неизвестный тип записи');
   const values=db.os6[k] as Array<Record<string,any>>;const data={...(f.record as object),id:id||newId()};(db.os6 as any)[k]=values.some(x=>x.id===data.id)?values.map(x=>x.id===data.id?data:x):[...values,data];return ok({id:data.id});
  }
  if(action==='entity_delete'){const k=({finance:'finance',workout:'workouts',weight:'weight',exercise:'exercises',repeat:'repeats',challenge:'challenges'} as Record<string,keyof OS6Data>)[asStr(f.entity)];if(!k)throw Error('Неизвестная запись');(db.os6 as any)[k]=(db.os6 as any)[k].filter((x:{id:string})=>x.id!==id);return ok()}
 }
 if(fn==='os8'){
  if(action==='goal_tasks_list'){
    const kind=asStr(f.kind),goalId=asStr(f.goalId);
    const goal=kind==='regular'?db.regularGoals.find(g=>g.id===goalId):db.goals.find(g=>g.id===goalId);
    if(!goal)throw Error('Цель не найдена');
    const ids=kind==='regular'?Object.entries(db.regularLinks).filter(([,id])=>id===goalId).map(([id])=>id):db.os6.links.filter(link=>link.goal_id===goalId).map(link=>link.task_id);
    const tasks=db.tasks.filter(task=>ids.includes(task.id));
    return ok({tasks,count:{total:tasks.length,done:tasks.filter(task=>task.completed).length}});
   }
   if(action==='goal_documents_list')return ok({documents:Object.values(db.goalDocuments||{})});
   if(action==='goal_document_save'){
    const kind=asStr(f.kind) as 'regular'|'strategic',goalId=asStr(f.goalId);
    const goal=kind==='regular'?db.regularGoals.find(x=>x.id===goalId):kind==='strategic'?db.goals.find(x=>x.id===goalId):null;
    if(!goal)throw Error('Цель не найдена');
    const fields=f.fields as GoalField[];
    if(!Array.isArray(fields)||fields.length>24||fields.filter(x=>x.featured).length>2)throw Error('Некорректные показатели');
    const notesBody=asStr(f.notesBody);
    if(notesBody.includes('[PERSONAL_OS_GOAL_DOCUMENT_V1]'))throw Error('Служебные данные не могут храниться в заметках');
    const change=asStr(f.statusChange),closed_at=change==='close'?now():change==='reopen'?null:asStr(f.closedAt)||null;
    db.goalDocuments||={};
    const document={goal_kind:kind,goal_id:goalId,fields:copy(fields),closed_at};
    db.goalDocuments[kind+':'+goalId]=document;
    if(kind==='regular'){const g=goal as RegularGoal;g.description=notesBody;if(change==='close'){g.completed=true;g.progress=100}else if(change==='reopen'){g.completed=false;g.progress=0}}
    else (goal as Goal).notes=notesBody;
    return ok({document});
   }
   if(action==='goals_list')return ok({goals:db.regularGoals});
  if(action==='goal_save'){const old=db.regularGoals.find(x=>x.id===id);const g:RegularGoal={id:old?.id||newId(),title:asStr(f.title).slice(0,180),description:asStr(f.description),period:(asStr(f.period)||'open') as RegularGoal['period'],starts_on:asStr(f.starts_on)||null,ends_on:asStr(f.ends_on)||null,progress:Math.max(0,Math.min(100,Number(f.progress)||0)),completed:Number(f.progress)===100,created_at:old?.created_at||now(),updated_at:now()};db.regularGoals=old?db.regularGoals.map(x=>x.id===id?g:x):[...db.regularGoals,g];return ok({id:g.id})}
  if(action==='goal_delete'){db.regularGoals=db.regularGoals.filter(x=>x.id!==id);for(const [task,g] of Object.entries(db.regularLinks))if(g===id)delete db.regularLinks[task];return ok()}
  if(action==='task_page_links')return ok({pageIds:Object.values(db.taskPages)});
  if(action==='task_page_ensure'){if(!db.tasks.some(t=>t.id===taskId))throw Error('Задача не найдена');
   let pageId=db.taskPages[taskId];if(!pageId){pageId=newId();const task=db.tasks.find(t=>t.id===taskId)!;db.pages.push({id:pageId,parent_id:null,title:task.title,icon:'📄',updated_at:now()});db.taskPages[taskId]=pageId;}
   return ok({pageId});
  }
  if(action==='task_page_find'){const found=Object.entries(db.taskPages).find(([,v])=>v===asStr(f.pageId));return ok({task:found?db.tasks.find(x=>x.id===found[0])||null:null})}
  if(action==='task_page_title'){const page=db.pages.find(x=>x.id===asStr(f.pageId)),task=Object.entries(db.taskPages).find(([,v])=>v===asStr(f.pageId));if(page)page.title=asStr(f.title);if(task){const t=db.tasks.find(x=>x.id===task[0]);if(t)t.title=asStr(f.title)}return ok()}
 }
 if(fn==='os9'){
  if(action==='archived_pages')return ok({pageIds:[]});
  if(action==='regular_goal_get')return ok({goalId:db.regularLinks[taskId]||null});
  if(action==='regular_goal_set'){if(f.goalId)db.regularLinks[taskId]=asStr(f.goalId);else delete db.regularLinks[taskId];return ok()}
  if(action==='regular_goal_stats'){const stats:Record<string,{total:number;done:number}>={};for(const [taskId,goalId] of Object.entries(db.regularLinks)){const t=db.tasks.find(x=>x.id===taskId);if(!t)continue;const entry=stats[goalId]||(stats[goalId]={total:0,done:0});entry.total++;if(t.completed)entry.done++;}return ok({stats})}
  if(action==='income_get')return ok({income:db.incomes[taskId]||null});
  if(action==='income_save'){if(!db.tasks.some(t=>t.id===taskId))throw Error('Задача не найдена');const currency=asStr(f.currency);if(!['RUB','USD','EUR'].includes(currency))throw Error('Недопустимая валюта');db.incomes[taskId]={amount:Math.max(0,Number(f.amount)||0),currency:currency as TaskIncome['currency'],confirmed:f.confirmed===true,earned_on:f.confirmed?asStr(f.earned_on)||dayToday():null};return ok()}
  if(action==='income_summary'){
   const totals:Record<string,number>={},daily:Record<string,Record<string,number>>={};let count=0;
   for(const v of Object.values(db.incomes))if(v.confirmed&&v.earned_on&&v.earned_on>=asStr(f.start)&&v.earned_on<=asStr(f.end)){totals[v.currency]=(totals[v.currency]||0)+v.amount;(daily[v.earned_on]||=( {}))[v.currency]=((daily[v.earned_on]||{})[v.currency]||0)+v.amount;count++;}
   return ok({totals,daily,count});
  }
 }
 if(fn==='os7')return workspaceAction(db,action,f);
 throw Error('QA Sandbox: тестовый метод '+fn+'.'+action+' пока не реализован; запрос в production заблокирован');
}
function workspaceAction(db:QAState,a:string,f:Record<string,unknown>):Record<string,unknown>{
 const id=asStr(f.id),pageId=asStr(f.pageId),sourceId=asStr(f.sourceId),blockId=asStr(f.blockId),splitId=asStr(f.splitId);
 if(a==='bootstrap')return ok({pages:db.pages,sources:db.sources,recordPageIds:db.records.map(x=>x.page_id)});
 if(a==='page_get'){const page=db.pages.find(x=>x.id===id);if(!page)throw Error('Страница не найдена');const blocks=ordered(db.blocks.filter(b=>b.page_id===id));const ids=blocks.map(x=>x.id);const splits=ordered(db.splits.filter(x=>ids.includes(x.block_id))),splitIds=splits.map(x=>x.id);return ok({page,blocks,splits,items:ordered(db.items.filter(x=>splitIds.includes(x.split_id))),record:db.records.find(x=>x.page_id===id)||null})}
 if(a==='page_save'){const p=db.pages.find(x=>x.id===id);if(p){p.title=asStr(f.title)||p.title;p.icon=asStr(f.icon)||p.icon;p.parent_id=asStr(f.parentId)||null;p.updated_at=now();const task=Object.entries(db.taskPages).find(([,v])=>v===p.id);if(task){const t=db.tasks.find(x=>x.id===task[0]);if(t)t.title=p.title;}return ok({id:p.id})}const next:WPage={id:newId(),title:asStr(f.title)||'Новая страница',icon:asStr(f.icon)||'📄',parent_id:asStr(f.parentId)||null,updated_at:now()};db.pages.push(next);return ok({id:next.id})}
 if(a==='page_delete'){removePage(db,id);return ok()}
 if(a==='block_save'){const b=db.blocks.find(x=>x.id===id);if(b){b.content=copy(f.content||{});return ok({id:b.id})}const next:WBlock={id:newId(),page_id:pageId,type:asStr(f.type) as WBlock['type'],position:nextPos(db.blocks.filter(x=>x.page_id===pageId)),content:copy(f.content||{})};db.blocks.push(next);return ok({id:next.id})}
 if(a==='block_delete'){const b=db.blocks.find(x=>x.id===id);if(b?.type==='pipeline'){const splits=db.splits.filter(x=>x.block_id===b.id);const keys=splits.map(x=>x.id);db.items=db.items.filter(x=>!keys.includes(x.split_id));db.splits=db.splits.filter(x=>x.block_id!==b.id)}db.blocks=db.blocks.filter(x=>x.id!==id);return ok()}
 if(a==='block_reorder'){reorder(db.blocks.filter(x=>x.page_id===pageId),f.ids as string[]);return ok()}
 if(a==='split_save'){const b=db.splits.find(x=>x.id===id);if(b){b.title=asStr(f.title);return ok({id:b.id})}const next:WSplit={id:newId(),block_id:blockId,title:asStr(f.title),position:nextPos(db.splits.filter(x=>x.block_id===blockId))};db.splits.push(next);return ok({id:next.id})}
 if(a==='split_delete'){db.items=db.items.filter(x=>x.split_id!==id);db.splits=db.splits.filter(x=>x.id!==id);return ok()}
 if(a==='split_reorder'){reorder(db.splits.filter(x=>x.block_id===blockId),f.ids as string[]);return ok()}
 if(a==='workflow_save'){const b=db.items.find(x=>x.id===id);if(b){if(f.title!==undefined)b.title=asStr(f.title);if(f.completed!==undefined)b.completed=f.completed===true;return ok({id:b.id})}const next:WItem={id:newId(),split_id:splitId,title:asStr(f.title),completed:false,position:nextPos(db.items.filter(x=>x.split_id===splitId))};db.items.push(next);return ok({id:next.id})}
 if(a==='workflow_delete'){db.items=db.items.filter(x=>x.id!==id);return ok()}
 if(a==='workflow_reorder'){reorder(db.items.filter(x=>x.split_id===splitId),f.ids as string[]);return ok()}
 if(a==='source_save'){const s=db.sources.find(x=>x.id===id);if(s){s.name=asStr(f.name);s.updated_at=now();return ok({id:s.id})}const next:WSource={id:newId(),name:asStr(f.name)||'База',updated_at:now()};db.sources.push(next);const field:WField={id:newId(),source_id:next.id,name:'Статус',field_type:'status',options:{choices:['К работе','В процессе','Готово']},position:1000};db.fields.push(field);(['table','board','list','calendar'] as WView['view_type'][]).forEach((type,i)=>db.views.push({id:newId(),source_id:next.id,name:({table:'Таблица',board:'Доска',list:'Список',calendar:'Календарь'} as Record<string,string>)[type],view_type:type,position:(i+1)*1000,config:{}}));return ok({id:next.id})}
 if(a==='source_get'){const source=db.sources.find(x=>x.id===id);if(!source)throw Error('База не найдена');const all=db.records.filter(x=>x.source_id===id),offset=Math.max(0,Number(f.offset)||0);return ok({source,fields:ordered(db.fields.filter(x=>x.source_id===id)),views:ordered(db.views.filter(x=>x.source_id===id)),records:all.slice(offset,offset+200),offset,hasMore:all.length>offset+200})}
 if(a==='field_save'){const old=db.fields.find(x=>x.id===id);const next:WField={id:old?.id||newId(),source_id:sourceId,name:asStr(f.name),field_type:asStr(f.fieldType) as WField['field_type'],options:copy(f.options||{}),position:old?.position||nextPos(db.fields.filter(x=>x.source_id===sourceId))};db.fields=old?db.fields.map(x=>x.id===id?next:x):[...db.fields,next];return ok({id:next.id})}
 if(a==='field_delete'){db.fields=db.fields.filter(x=>x.id!==id);return ok()}
 if(a==='view_save'){const old=db.views.find(x=>x.id===id);const next:WView={id:old?.id||newId(),source_id:sourceId,name:asStr(f.name),view_type:asStr(f.viewType) as WView['view_type'],config:copy(f.config||{}),position:old?.position||nextPos(db.views.filter(x=>x.source_id===sourceId))};db.views=old?db.views.map(x=>x.id===id?next:x):[...db.views,next];return ok({id:next.id})}
 if(a==='view_delete'){db.views=db.views.filter(x=>x.id!==id);return ok()}
 if(a==='record_save'){const old=db.records.find(x=>x.id===id);let pageId=old?.page_id;if(!pageId){pageId=newId();db.pages.push({id:pageId,parent_id:null,title:asStr(f.title),icon:'🗂️',updated_at:now()})}const next:WRecord={id:old?.id||newId(),source_id:sourceId,page_id:pageId,title:asStr(f.title),properties:copy(f.properties||{}),created_at:old?.created_at||now()};db.records=old?db.records.map(x=>x.id===id?next:x):[...db.records,next];return ok({id:next.id,pageId})}
 if(a==='record_delete'){const row=db.records.find(x=>x.id===id);if(row)removePage(db,row.page_id);db.records=db.records.filter(x=>x.id!==id);return ok()}
 throw Error('QA Sandbox: workspace '+a+' не реализован');
}
export async function qaRequest<T=any>(fn:string,action:string,fields:Record<string,unknown>={}):Promise<T>{
 // No fetch, Supabase client, Telegram token or production data is used here.
 const db=load();const response=mutate(db,fn,action,fields);persist(db);
 return response as T;
}
