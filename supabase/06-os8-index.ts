// Personal OS 6.3: task pages and regular goals. Verify JWT OFF ONLY with Telegram HMAC verification intact.
import {createClient} from 'npm:@supabase/supabase-js@2';
const origin='https://vanyamars.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Vary':'Origin'};
const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
const enc=new TextEncoder();
const idOk=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
const iso=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const trimmed=(s:unknown,max=180)=>typeof s==='string'?s.trim().slice(0,max):'';
async function verify(raw:string):Promise<number|null>{
 const token=Deno.env.get('TG_BOT_TOKEN')||'';if(!token||!raw||raw.length>8192)return null;
 try{const q=new URLSearchParams(raw),hash=q.get('hash')||'';if(!/^[a-f\d]{64}$/i.test(hash))return null;
  const age=Math.floor(Date.now()/1000)-Number(q.get('auth_date'));if(!Number.isFinite(age)||age < -60||age>86400)return null;
  const check=[...q.entries()].filter(([k])=>k!=='hash').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
  const k1=await crypto.subtle.importKey('raw',enc.encode('WebAppData'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const secret=await crypto.subtle.sign('HMAC',k1,enc.encode(token));
  const k2=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const actual=new Uint8Array(await crypto.subtle.sign('HMAC',k2,enc.encode(check)));
  const sent=Uint8Array.from(hash.match(/.{2}/g)!.map(x=>parseInt(x,16)));
  let diff=actual.length^sent.length;for(let i=0;i<actual.length;i++)diff|=actual[i]^sent[i];if(diff)return null;
  const user=JSON.parse(q.get('user')||'null');return Number.isSafeInteger(user?.id)&&user.id>0?user.id:null;
 }catch{return null;}
}
const admin=()=>{const url=Deno.env.get('SUPABASE_URL')||'';let key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 try{key=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||key;}catch{}if(!url||!key)throw Error('Missing backend configuration');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
};
async function must<T>(v:PromiseLike<{data:T;error:any}>):Promise<T>{const r=await v;if(r.error)throw r.error;return r.data;}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({ok:false,error:'POST required'},405);
 try{
  const body=await req.json();const uid=await verify(String(body?.initData||''));if(!uid)return reply({ok:false,error:'Telegram authorization failed'},401);
  const allowed=Deno.env.get('TG_ALLOWED_USER_ID');if(allowed&&allowed!==String(uid))return reply({ok:false,error:'Access denied'},403);
  const db=admin(),act=String(body.action||'');
  // One query per goal, not one API request per task: all linked tasks, including Buffer.
  if(act==='goal_tasks_list'){
   const kind=body.kind,goalId=body.goalId;
   if(!['regular','strategic'].includes(kind)||!idOk(goalId))return reply({ok:false,error:'Неверная цель'},400);
   const goalTable=kind==='regular'?'os8_regular_goals':'ambitious_goals';
   const owned=await must(db.from(goalTable).select('id').eq('id',goalId).eq('telegram_user_id',uid).maybeSingle());
   if(!owned)return reply({ok:false,error:'Цель не найдена'},404);
   const table=kind==='regular'?'os9_regular_goal_tasks':'os6_task_goal';
   const rows=await must(db.from(table).select('task_id').eq('telegram_user_id',uid).eq('goal_id',goalId).limit(1001));
   if(rows.length>1000)return reply({ok:false,error:'Слишком много связанных задач для одной загрузки'},413);
   const ids=rows.map((r:any)=>r.task_id);
   if(!ids.length)return reply({ok:true,tasks:[],count:{total:0,done:0}});
   const tasks=await must(db.from('personal_tasks').select('id,title,notes,sphere,day,priority,completed,os61_category_id,os61_position').eq('telegram_user_id',uid).in('id',ids).order('created_at',{ascending:false}).limit(1000));
   return reply({ok:true,tasks,count:{total:tasks.length,done:tasks.filter((t:any)=>t.completed).length}});
  }
  // Normalized goal properties — authenticated by existing Telegram HMAC above.
  if(act==='goal_documents_list'){
   const documents=await must(db.from('os10_goal_documents').select('goal_kind,goal_id,fields,closed_at,updated_at').eq('telegram_user_id',uid).limit(800));
   return reply({ok:true,documents});
  }
  if(act==='goal_document_save'){
   const kind=body.kind,goalId=body.goalId;
   if(!['regular','strategic'].includes(kind)||!idOk(goalId))return reply({ok:false,error:'Неверная цель'},400);
   const table=kind==='regular'?'os8_regular_goals':'ambitious_goals';
   const owned=await must(db.from(table).select('id').eq('telegram_user_id',uid).eq('id',goalId).maybeSingle());
   if(!owned)return reply({ok:false,error:'Цель не найдена'},404);
   const raw=body.fields;
   if(!Array.isArray(raw)||raw.length>24)return reply({ok:false,error:'Не больше 24 показателей'},400);
   const kinds=['number','percent','text','checkbox','date','select'],fields=[] as Record<string,unknown>[];
   let featured=0;
   for(const f of raw){
    if(!f||typeof f.id!=='string'||f.id.length>80||typeof f.label!=='string'||f.label.length>100||!kinds.includes(f.type)||typeof f.value!=='string'||f.value.length>400)return reply({ok:false,error:'Некорректный показатель'},400);
    if(f.featured===true)featured++;
    fields.push({id:f.id,label:f.label,type:f.type,value:f.value,start:typeof f.start==='string'?f.start.slice(0,60):'',target:typeof f.target==='string'?f.target.slice(0,60):'',unit:typeof f.unit==='string'?f.unit.slice(0,30):'',options:Array.isArray(f.options)?f.options.filter((x:unknown)=>typeof x==='string').slice(0,12).map((x:string)=>x.slice(0,80)):[],featured:f.featured===true});
   }
   if(featured>2||JSON.stringify(fields).length>5600)return reply({ok:false,error:'Слишком много ключевых показателей или данных'},400);
   const change=body.statusChange;
   if(change!==undefined&&!['close','reopen'].includes(change))return reply({ok:false,error:'Неверный статус'},400);
   const closedAt=change==='close'?new Date().toISOString():change==='reopen'?null:body.closedAt||null;
   if(closedAt!==null&&(typeof closedAt!=='string'||Number.isNaN(Date.parse(closedAt))))return reply({ok:false,error:'Неверная дата'},400);
   if(typeof body.notesBody!=='string'||body.notesBody.length>6000||body.notesBody.includes('[PERSONAL_OS_GOAL_DOCUMENT_V1]'))return reply({ok:false,error:'Не удалось очистить заметки'},400);
   // Save metadata first. Old notes are cleaned only after persistence succeeds.
   await must(db.from('os10_goal_documents').upsert({telegram_user_id:uid,goal_kind:kind,goal_id:goalId,fields,closed_at:closedAt,updated_at:new Date().toISOString()},{onConflict:'telegram_user_id,goal_kind,goal_id'}).select('goal_id').single());
   const values:any={updated_at:new Date().toISOString()};
   if(kind==='regular'){values.description=body.notesBody;if(change==='close'){values.progress=100;values.completed=true}else if(change==='reopen'){values.progress=0;values.completed=false}}
   else values.notes=body.notesBody;
   await must(db.from(table).update(values).eq('telegram_user_id',uid).eq('id',goalId).select('id').single());
   return reply({ok:true,document:{goal_kind:kind,goal_id:goalId,fields,closed_at:closedAt}});
  }
  if(act==='goals_list'){
   const goals=await must(db.from('os8_regular_goals').select('*').eq('telegram_user_id',uid).order('updated_at',{ascending:false}).limit(300));
   return reply({ok:true,goals});
  }
  if(act==='goal_save'){
   const title=trimmed(body.title);if(!title)return reply({ok:false,error:'Укажи название цели'},400);
   const period=String(body.period||'open');if(!['open','week','month','deadline'].includes(period))return reply({ok:false,error:'Неверный период'},400);
   const starts=body.starts_on||null,ends=body.ends_on||null;
   if((starts&&!iso(starts))||(ends&&!iso(ends))||(starts&&ends&&starts>ends))return reply({ok:false,error:'Проверь даты'},400);
   if(period==='deadline'&&!ends)return reply({ok:false,error:'Укажи дату завершения'},400);
   const progress=Number(body.progress);if(!Number.isInteger(progress)||progress<0||progress>100)return reply({ok:false,error:'Прогресс должен быть от 0 до 100'},400);
   const values={title,description:trimmed(body.description,6000),period,starts_on:starts,ends_on:ends,progress,completed:progress===100,updated_at:new Date().toISOString()};
   if(body.id){if(!idOk(body.id))return reply({ok:false,error:'Неверный ID'},400);
    const changed=await must(db.from('os8_regular_goals').update(values).eq('id',body.id).eq('telegram_user_id',uid).select('id').maybeSingle());
    if(!changed)return reply({ok:false,error:'Цель не найдена'},404);return reply({ok:true,id:changed.id});
   }
   const created=await must(db.from('os8_regular_goals').insert({...values,telegram_user_id:uid}).select('id').single());
   return reply({ok:true,id:created.id});
  }
  if(act==='goal_delete'){
   if(!idOk(body.id))return reply({ok:false,error:'Неверный ID'},400);
   await must(db.from('os8_regular_goals').delete().eq('telegram_user_id',uid).eq('id',body.id));return reply({ok:true});
  }
  if(act==='task_page_ensure'){
   if(!idOk(body.taskId))return reply({ok:false,error:'Неверный ID задачи'},400);
   const task=await must(db.from('personal_tasks').select('id,title').eq('telegram_user_id',uid).eq('id',body.taskId).maybeSingle());
   if(!task)return reply({ok:false,error:'Задача не найдена'},404);
   const old=await must(db.from('os8_task_pages').select('page_id').eq('telegram_user_id',uid).eq('task_id',task.id).maybeSingle());
   if(old){await must(db.from('os7_pages').update({title:task.title,updated_at:new Date().toISOString()}).eq('id',old.page_id).eq('telegram_user_id',uid));return reply({ok:true,pageId:old.page_id});}
   const page=await must(db.from('os7_pages').insert({telegram_user_id:uid,title:task.title,icon:'📝'}).select('id').single());
   const {error:linkErr}=await db.from('os8_task_pages').insert({telegram_user_id:uid,task_id:task.id,page_id:page.id});
   if(linkErr){await db.from('os7_pages').delete().eq('id',page.id).eq('telegram_user_id',uid);
    const found=await must(db.from('os8_task_pages').select('page_id').eq('telegram_user_id',uid).eq('task_id',task.id).maybeSingle());
    if(found)return reply({ok:true,pageId:found.page_id});throw linkErr;
   }
   return reply({ok:true,pageId:page.id});
  }
  if(act==='task_page_links'){
    const links=await must(db.from('os8_task_pages').select('page_id').eq('telegram_user_id',uid).limit(10000));
    return reply({ok:true,pageIds:links.map((x:any)=>x.page_id)});
  }
  if(act==='task_page_find'){
   if(!idOk(body.pageId))return reply({ok:false,error:'Неверный ID страницы'},400);
   const link=await must(db.from('os8_task_pages').select('task_id').eq('telegram_user_id',uid).eq('page_id',body.pageId).maybeSingle());
   if(!link)return reply({ok:true,task:null});
   const task=await must(db.from('personal_tasks').select('id,title,notes,sphere,day,priority,completed,os61_category_id').eq('id',link.task_id).eq('telegram_user_id',uid).maybeSingle());
   return reply({ok:true,task:task||null});
  }
  if(act==='task_page_title'){
   if(!idOk(body.pageId))return reply({ok:false,error:'Неверный ID'},400);
   const title=trimmed(body.title);if(!title)return reply({ok:false,error:'Введите название'},400);
   const link=await must(db.from('os8_task_pages').select('task_id').eq('page_id',body.pageId).eq('telegram_user_id',uid).maybeSingle());
   if(!link)return reply({ok:false,error:'Страница задачи не найдена'},404);
   await must(db.from('personal_tasks').update({title}).eq('id',link.task_id).eq('telegram_user_id',uid));
   await must(db.from('os7_pages').update({title,updated_at:new Date().toISOString()}).eq('id',body.pageId).eq('telegram_user_id',uid));
   return reply({ok:true});
  }
  return reply({ok:false,error:'Unknown action'},400);
 }catch(e:any){console.error('os8 error',String(e?.message||e));return reply({ok:false,error:'Не удалось выполнить запрос'},500);}
});
