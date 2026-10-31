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

  if(act==='task_property_fields'){
   const fields=await must(db.from('os11_task_property_definitions').select('id,name,field_type,options').eq('telegram_user_id',uid).order('position').limit(100));
   return reply({ok:true,fields});
  }
  if(act==='task_property_define'){
   const name=trimmed(body.name,80),type=String(body.fieldType||'');
   if(!name||!['duration','number','text','checkbox','date','select'].includes(type))return reply({ok:false,error:'Недопустимый тип свойства'},400);
   const choices=type==='select'&&Array.isArray(body.choices)?body.choices.filter((x:unknown)=>typeof x==='string'&&x.length<=80).slice(0,25):[];
   const existing=await must(db.from('os11_task_property_definitions').select('id').eq('telegram_user_id',uid).limit(101));
   if(existing.length>=100)return reply({ok:false,error:'Лимит свойств'},413);
   const field=await must(db.from('os11_task_property_definitions').insert({telegram_user_id:uid,name,field_type:type,options:{choices}}).select('id').single());
   return reply({ok:true,id:field.id});
  }
  if(act==='task_property_values'||act==='task_property_set'){
   if(!idOk(body.taskId))return reply({ok:false,error:'Некорректный ID задачи'},400);
   const task=await must(db.from('personal_tasks').select('id').eq('telegram_user_id',uid).eq('id',body.taskId).maybeSingle());
   if(!task)return reply({ok:false,error:'Задача не найдена'},404);
   if(act==='task_property_values'){
    const rows=await must(db.from('os11_task_property_values').select('property_id,value').eq('telegram_user_id',uid).eq('task_id',body.taskId).limit(100));
    return reply({ok:true,values:Object.fromEntries(rows.map((x:any)=>[x.property_id,x.value]))});
   }
   if(!idOk(body.propertyId))return reply({ok:false,error:'Некорректное свойство'},400);
   const field=await must(db.from('os11_task_property_definitions').select('field_type,options').eq('telegram_user_id',uid).eq('id',body.propertyId).maybeSingle());
   if(!field)return reply({ok:false,error:'Свойство не найдено'},404);
   const value=String(body.value??'');
   if(value.length>2000)return reply({ok:false,error:'Слишком длинное значение'},400);
   if(value!==''){
    if(field.field_type==='duration'&&(!Number.isSafeInteger(Number(value))||Number(value)<0||Number(value)>10000000))return reply({ok:false,error:'Продолжительность в целых минутах'},400);
    if(field.field_type==='number'&&(!Number.isFinite(Number(value))||Math.abs(Number(value))>1e12))return reply({ok:false,error:'Некорректное число'},400);
    if(field.field_type==='checkbox'&&!['true','false'].includes(value))return reply({ok:false,error:'Некорректный флажок'},400);
    if(field.field_type==='date'&&!iso(value))return reply({ok:false,error:'Некорректная дата'},400);
    if(field.field_type==='select'&&!(field.options?.choices||[]).includes(value))return reply({ok:false,error:'Вариант не найден'},400);
   }
   await must(db.from('os11_task_property_values').upsert({telegram_user_id:uid,task_id:body.taskId,property_id:body.propertyId,value,updated_at:new Date().toISOString()},{onConflict:'telegram_user_id,task_id,property_id'}).select('property_id').single());
   return reply({ok:true});
  }
  if(act==='goal_rollup_get'||act==='goal_rollup_save'){
   const kind=String(body.kind||''),goalId=body.goalId;
   if(!['regular','strategic'].includes(kind)||!idOk(goalId))return reply({ok:false,error:'Некорректная цель'},400);
   const table=kind==='regular'?'os8_regular_goals':'ambitious_goals';
   const goal=await must(db.from(table).select('id').eq('telegram_user_id',uid).eq('id',goalId).maybeSingle());
   if(!goal)return reply({ok:false,error:'Цель не найдена'},404);
   if(act==='goal_rollup_save'){
    if(!idOk(body.propertyId))return reply({ok:false,error:'Некорректный ID поля'},400);
    const f=await must(db.from('os11_task_property_definitions').select('field_type').eq('telegram_user_id',uid).eq('id',body.propertyId).maybeSingle());
    if(!f||!['duration','number'].includes(f.field_type))return reply({ok:false,error:'Нужно числовое поле'},400);
    if(body.remove===true)await must(db.from('os11_goal_rollups').delete().eq('telegram_user_id',uid).eq('goal_kind',kind).eq('goal_id',goalId).eq('property_id',body.propertyId));
    else{
     const target=body.target===''||body.target==null?null:Number(body.target),label=trimmed(body.label,80);
     if(!label||target!==null&&(!Number.isFinite(target)||target<=0||target>1e12))return reply({ok:false,error:'Проверь показатель'},400);
     await must(db.from('os11_goal_rollups').upsert({telegram_user_id:uid,goal_kind:kind,goal_id:goalId,property_id:body.propertyId,label,target},{onConflict:'telegram_user_id,goal_kind,goal_id,property_id'}).select('goal_id').single());
    }
    return reply({ok:true});
   }
   const fields=await must(db.from('os11_task_property_definitions').select('id,name,field_type').eq('telegram_user_id',uid).in('field_type',['duration','number']).limit(100));
   const rollups=await must(db.from('os11_goal_rollups').select('property_id,label,target').eq('telegram_user_id',uid).eq('goal_kind',kind).eq('goal_id',goalId).limit(40));
   const links=await must(db.from(kind==='regular'?'os9_regular_goal_tasks':'os6_task_goal').select('task_id').eq('telegram_user_id',uid).eq('goal_id',goalId).limit(1001));
   if(links.length>1000)return reply({ok:false,error:'Слишком много задач'},413);
   const ids=links.map((x:any)=>x.task_id),sums:Record<string,number>={};
   if(ids.length){
    const rows=await must(db.from('os11_task_property_values').select('property_id,value').eq('telegram_user_id',uid).in('task_id',ids).limit(100000));
    for(const x of rows){if(!fields.some((f:any)=>f.id===x.property_id)||x.value==='')continue;const n=Number(x.value);if(Number.isFinite(n))sums[x.property_id]=(sums[x.property_id]||0)+n;}
   }
   return reply({ok:true,fields,rollups:rollups.map((x:any)=>({...x,total:sums[x.property_id]||0})),linkedTasks:ids.length});
  }
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

  if(act==='task_cards_meta'){
   const ids=Array.isArray(body.taskIds)?[...new Set(body.taskIds.filter(idOk))].slice(0,120):[];
   if(!ids.length)return reply({ok:true,cards:{}});
   const owned=await must(db.from('personal_tasks').select('id').eq('telegram_user_id',uid).in('id',ids));
   const cards:Record<string,{emoji:string;progress:number|null}>={};
   for(const t of owned)cards[t.id]={emoji:'📋',progress:null};
   if(!owned.length)return reply({ok:true,cards});
   const links=await must(db.from('os8_task_pages').select('task_id,page_id').eq('telegram_user_id',uid).in('task_id',owned.map((t:any)=>t.id)));
   if(!links.length)return reply({ok:true,cards});
   const pages=await must(db.from('os7_pages').select('id,icon').eq('telegram_user_id',uid).in('id',links.map((l:any)=>l.page_id)));
   const blocks=await must(db.from('os7_blocks').select('id,page_id').eq('telegram_user_id',uid).eq('type','pipeline').in('page_id',links.map((l:any)=>l.page_id)).limit(1000));
   const splits=blocks.length?await must(db.from('os7_splits').select('id,block_id').eq('telegram_user_id',uid).in('block_id',blocks.map((b:any)=>b.id)).limit(3000)):[];
   const items=splits.length?await must(db.from('os7_workflow_items').select('split_id,completed').eq('telegram_user_id',uid).in('split_id',splits.map((x:any)=>x.id)).limit(8000)):[];
   for(const l of links){
    const icon=pages.find((p:any)=>p.id===l.page_id)?.icon;
    const pipelines=blocks.filter((b:any)=>b.page_id===l.page_id);
    const splitIds=new Set(splits.filter((x:any)=>pipelines.some((b:any)=>b.id===x.block_id)).map((x:any)=>x.id));
    const relevant=items.filter((x:any)=>splitIds.has(x.split_id));
    cards[l.task_id]={emoji:icon&&icon!=='📝'&&icon!=='📄'?icon:'📋',progress:pipelines.length?(relevant.length?Math.round(relevant.filter((x:any)=>x.completed).length/relevant.length*100):0):null};
   }
   return reply({ok:true,cards});
  }
  if(act==='task_emoji_set'){
   if(!idOk(body.taskId))return reply({ok:false,error:'Неверная задача'},400);
   const emoji=trimmed(body.emoji,24);
   if(!emoji||Array.from(emoji).length>8||/[<>]/.test(emoji))return reply({ok:false,error:'Некорректный эмодзи'},400);
   const task=await must(db.from('personal_tasks').select('id,title').eq('id',body.taskId).eq('telegram_user_id',uid).maybeSingle());
   if(!task)return reply({ok:false,error:'Задача не найдена'},404);
   let link=await must(db.from('os8_task_pages').select('page_id').eq('task_id',body.taskId).eq('telegram_user_id',uid).maybeSingle());
   if(!link){
    const page=await must(db.from('os7_pages').insert({telegram_user_id:uid,title:task.title,icon:emoji}).select('id').single());
    const created=await db.from('os8_task_pages').insert({telegram_user_id:uid,task_id:task.id,page_id:page.id});
    if(created.error){
     await db.from('os7_pages').delete().eq('telegram_user_id',uid).eq('id',page.id);
     link=await must(db.from('os8_task_pages').select('page_id').eq('telegram_user_id',uid).eq('task_id',task.id).maybeSingle());
     if(!link)throw created.error;
    }else link={page_id:page.id};
   }
   await must(db.from('os7_pages').update({icon:emoji,updated_at:new Date().toISOString()}).eq('telegram_user_id',uid).eq('id',link.page_id).select('id').single());
   return reply({ok:true,emoji});
  }
  if(act==='task_page_ensure'){
   if(!idOk(body.taskId))return reply({ok:false,error:'Неверный ID задачи'},400);
   const task=await must(db.from('personal_tasks').select('id,title').eq('telegram_user_id',uid).eq('id',body.taskId).maybeSingle());
   if(!task)return reply({ok:false,error:'Задача не найдена'},404);
   const old=await must(db.from('os8_task_pages').select('page_id').eq('telegram_user_id',uid).eq('task_id',task.id).maybeSingle());
   if(old){await must(db.from('os7_pages').update({title:task.title,updated_at:new Date().toISOString()}).eq('id',old.page_id).eq('telegram_user_id',uid));
   const existing=await must(db.from('os7_blocks').select('id').eq('telegram_user_id',uid).eq('page_id',old.page_id).eq('type','heading').limit(1));
   if(!existing.length)await must(db.from('os7_blocks').insert({telegram_user_id:uid,page_id:old.page_id,type:'heading',position:0,content:{text:''}}).select('id').single());
   return reply({ok:true,pageId:old.page_id});}
   const page=await must(db.from('os7_pages').insert({telegram_user_id:uid,title:task.title,icon:'📋'}).select('id').single());
   const {error:linkErr}=await db.from('os8_task_pages').insert({telegram_user_id:uid,task_id:task.id,page_id:page.id});
   if(linkErr){await db.from('os7_pages').delete().eq('id',page.id).eq('telegram_user_id',uid);
    const found=await must(db.from('os8_task_pages').select('page_id').eq('telegram_user_id',uid).eq('task_id',task.id).maybeSingle());
    if(found)return reply({ok:true,pageId:found.page_id});throw linkErr;
   }
   await must(db.from('os7_blocks').insert({telegram_user_id:uid,page_id:page.id,type:'heading',position:0,content:{text:''}}).select('id').single());
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
