// Personal OS 6.0 / Edge Function named "os6".
// The handler validates Mini App data or a signed ProDesk browser session.
// Supabase service-role credentials never leave this function.
import { createClient } from "npm:@supabase/supabase-js@2";
import { browserSiteOrigin, verifyBrowserUser } from "../_shared/browser-auth.ts";

const ORIGIN = browserSiteOrigin();
const headers = {"Content-Type":"application/json;charset=utf-8","Access-Control-Allow-Origin":ORIGIN,
  "Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
const out=(data:unknown,code=200)=>new Response(JSON.stringify(data),{status:code,headers});
const enc=new TextEncoder();
const uuid=(s:unknown)=>typeof s==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const dateOK=(s:unknown):s is string=>typeof s==="string"&&/^\d{4}-\d\d-\d\d$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const monday=(s:string)=>new Date(s+"T00:00:00Z").getUTCDay()===1;
const str=(v:unknown,max:number,def="")=>typeof v==="string"?v.trim().slice(0,max):def;
const int=(v:unknown,min:number,max:number)=>Number.isInteger(Number(v))&&Number(v)>=min&&Number(v)<=max?Number(v):null;
const num=(v:unknown,min:number,max:number)=>typeof v!=="boolean"&&Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max?Math.round(Number(v)*100)/100:null;
const todayUTC=()=>new Date().toISOString().slice(0,10);
const add=(s:string,n:number)=>new Date(Date.parse(s+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
const lengthDays=(a:string,b:string)=>Math.round((Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/86400000);

async function telegramUser(raw:string):Promise<{id:number;first_name?:string}|null>{
  const token=Deno.env.get("TG_BOT_TOKEN")||"";
  if(!token||!raw||raw.length>8192)return null;
  try {
    const p=new URLSearchParams(raw), hash=p.get("hash")||"";
    if(!/^[0-9a-f]{64}$/i.test(hash))return null;
    const at=Number(p.get("auth_date")), age=Math.floor(Date.now()/1000)-at;
    if(!Number.isInteger(at)||age< -60||age>86400)return null;
    const msg=[...p.entries()].filter(([k])=>k!=="hash").sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join("\n");
    const key1=await crypto.subtle.importKey("raw",enc.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const secret=await crypto.subtle.sign("HMAC",key1,enc.encode(token));
    const key2=await crypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const actual=new Uint8Array(await crypto.subtle.sign("HMAC",key2,enc.encode(msg)));
    const expected=Uint8Array.from(hash.match(/.{2}/g)!.map(x=>parseInt(x,16)));
    let diff=actual.length^expected.length;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i];
    if(diff)return null;
    const u=JSON.parse(p.get("user")||"null");
    return Number.isSafeInteger(u?.id)&&u.id>0?{id:u.id,first_name:str(u.first_name,128)}:null;
  }catch{return null;}
}
function admin(){const url=Deno.env.get("SUPABASE_URL"),raw=Deno.env.get("SUPABASE_SECRET_KEYS")||"";
  let key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  try{key=JSON.parse(raw).default||key;}catch{/* legacy key */}
  if(!url||!key)throw Error("Backend credentials missing");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
type DB=ReturnType<typeof createClient>;
async function must(p:PromiseLike<{data:any;error:any}>){const r=await p;if(r.error)throw r.error;return r.data;}
async function ensureSettings(db:DB,uid:number){
  let s=await must(db.from("os6_settings").select("*").eq("telegram_user_id",uid).maybeSingle());
  if(!s){const row={telegram_user_id:uid,kpi_cutover:todayUTC()};
    await must(db.from("os6_settings").upsert(row,{onConflict:"telegram_user_id",ignoreDuplicates:true}));
    s=await must(db.from("os6_settings").select("*").eq("telegram_user_id",uid).single());
    await must(db.from("os6_kpi_history").upsert({telegram_user_id:uid,effective_from:s.kpi_cutover,target_task:s.target_task,target_sale:s.target_sale,target_sport:s.target_sport},{onConflict:"telegram_user_id,effective_from",ignoreDuplicates:true}));
  }
  return s;
}
function repeatsOn(r:any,day:string){
  if(!r.enabled||day<r.starts_on||(r.ends_on&&day>r.ends_on))return false;
  const dif=lengthDays(r.starts_on,day), interval=Number(r.interval_n)||1;
  if(r.frequency==="daily")return dif%interval===0;
  if(r.frequency==="weekly"){
    const dayOfWeek=new Date(day+"T00:00:00Z").getUTCDay()||7;
    return Array.isArray(r.weekdays)&&r.weekdays.includes(dayOfWeek)&&Math.floor(dif/7)%interval===0;
  }
  if(r.frequency==="monthly"){
    const a=new Date(r.starts_on+"T00:00:00Z"),b=new Date(day+"T00:00:00Z");
    const months=(b.getUTCFullYear()-a.getUTCFullYear())*12+(b.getUTCMonth()-a.getUTCMonth());
    const daysInMonth=new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth()+1,0)).getUTCDate();
    return months>=0&&months%interval===0&&b.getUTCDate()===Math.min(a.getUTCDate(),daysInMonth);
  }
  return false;
}
async function generateRepeats(db:DB,uid:number,start:string,count=14){
  const rules=await must(db.from("os6_repeats").select("*").eq("telegram_user_id",uid).eq("enabled",true).limit(200));
  const rows:any[]=[];
  for(let i=0;i<count;i++){
    const day=add(start,i);
    for(const r of rules||[])if(repeatsOn(r,day))rows.push({telegram_user_id:uid,title:r.title,notes:"",sphere:r.sphere,day,priority:r.priority,completed:false,os6_repeat_id:r.id});
  }
  if(rows.length)await must(db.from("personal_tasks").upsert(rows,{onConflict:"telegram_user_id,os6_repeat_id,day",ignoreDuplicates:true}));
}
const tables:Record<string,string>={finance:"os6_finance",workout:"os6_workouts",exercise:"os6_exercises",weight:"os6_body_weight",repeat:"os6_repeats",challenge:"os6_challenges"};
function validEntity(type:string,p:any){
  if(!p||typeof p!=="object")return null;
  switch(type){
    case "finance":{
      const amount=num(p.amount,0.01,1e11), day=p.day, direction=p.direction;
      if(amount===null||!dateOK(day)||!["income","expense"].includes(direction))return null;
      const currency=str(p.currency,8,"RUB").toUpperCase();
      if(!/^[A-Z]{3,8}$/.test(currency))return null;
      return {day,direction,amount,currency,category:str(p.category,80,"Другое")||"Другое",note:str(p.note,1500),is_sale:direction==="income"&&p.is_sale===true};
    }
    case "workout":{
      const duration_min=int(p.duration_min,0,1440);
      if(!dateOK(p.day)||!str(p.title,180)||duration_min===null)return null;
      return {day:p.day,title:str(p.title,180),duration_min,notes:str(p.notes,2000)};
    }
    case "exercise":{
      const sets=int(p.sets,1,100),reps=int(p.reps,0,1000),weight_kg=p.weight_kg===""||p.weight_kg===null?null:num(p.weight_kg,0,10000);
      if(!uuid(p.workout_id)||!str(p.title,120)||sets===null||reps===null||(p.weight_kg!==null&&p.weight_kg!==""&&weight_kg===null))return null;
      return {workout_id:p.workout_id,title:str(p.title,120),sets,reps,weight_kg};
    }
    case "weight":{const kg=num(p.kg,0.01,999.99);if(!dateOK(p.day)||kg===null)return null;return {day:p.day,kg,note:str(p.note,500)};}
    case "repeat":{
      const frequency=p.frequency,interval_n=int(p.interval_n,1,52),w=Array.isArray(p.weekdays)?p.weekdays.map(Number).filter((x:number)=>Number.isInteger(x)&&x>=1&&x<=7):[];
      if(!str(p.title,180)||!["daily","weekly","monthly"].includes(frequency)||interval_n===null||!dateOK(p.starts_on)||(p.ends_on!==null&&!dateOK(p.ends_on))||(p.ends_on&&p.ends_on<p.starts_on))return null;
      return {title:str(p.title,180),sphere:str(p.sphere,60,"Личное")||"Личное",priority:["important","extra"].includes(p.priority)?p.priority:"extra",frequency,interval_n,weekdays:w,starts_on:p.starts_on,ends_on:p.ends_on||null,enabled:p.enabled!==false};
    }
    case "challenge":{
      const target_days=int(p.target_days,1,366);
      if(!str(p.title,180)||!dateOK(p.starts_on)||!dateOK(p.ends_on)||p.ends_on<p.starts_on||target_days===null||target_days>lengthDays(p.starts_on,p.ends_on)+1)return null;
      return {title:str(p.title,180),starts_on:p.starts_on,ends_on:p.ends_on,target_days,note:str(p.note,1500)};
    }
  }
  return null;
}
async function entitySave(db:DB,uid:number,b:any){
  const table=tables[String(b.entity)];if(!table)return out({error:"Неизвестный раздел"},400);
  const values=validEntity(String(b.entity),b.record);if(!values)return out({error:"Проверь поля формы"},400);
  if(b.entity==="exercise"){
    const owned=await must(db.from("os6_workouts").select("id").eq("id",(values as any).workout_id).eq("telegram_user_id",uid).maybeSingle());
    if(!owned)return out({error:"Тренировка не найдена"},404);
  }
  const id=b.id===undefined||b.id===null?null:b.id;
  if(id!==null&&!uuid(id))return out({error:"Неверный ID"},400);
  if(id){const data=await must(db.from(table).update(values).eq("id",id).eq("telegram_user_id",uid).select("id").maybeSingle());return data?out({ok:true,id}):out({error:"Запись не найдена"},404);}
  const data=await must(db.from(table).insert({...values,telegram_user_id:uid}).select("id").single());return out({ok:true,id:data.id});
}
async function entityDelete(db:DB,uid:number,b:any){
  const table=tables[String(b.entity)];if(!table||!uuid(b.id))return out({error:"Неверная запись"},400);
  const data=await must(db.from(table).delete().eq("id",b.id).eq("telegram_user_id",uid).select("id").maybeSingle());
  return data?out({ok:true}):out({error:"Запись не найдена"},404);
}
async function metrics(db:DB,uid:number,b:any){
  if(!dateOK(b.start)||!dateOK(b.end)||lengthDays(b.start,b.end)<0||lengthDays(b.start,b.end)>65)return out({error:"Допустим интервал до 66 дней"},400);
  const [tasks,finances,sports,events]=await Promise.all([
    must(db.from("personal_tasks").select("day,completed,priority").eq("telegram_user_id",uid).gte("day",b.start).lte("day",b.end).limit(2500)),
    must(db.from("os6_finance").select("day,direction,is_sale").eq("telegram_user_id",uid).gte("day",b.start).lte("day",b.end).limit(2500)),
    must(db.from("os6_workouts").select("day").eq("telegram_user_id",uid).gte("day",b.start).lte("day",b.end).limit(2000)),
    must(db.from("os6_task_events").select("event,day,happened_at").eq("telegram_user_id",uid).gte("happened_at",b.start+"T00:00:00Z").lte("happened_at",b.end+"T23:59:59Z").limit(2500))
  ]);
  const result:Record<string,{tasks:number;sales:number;sport:number;planned:number;important:number;done_important:number;extras:number;done_extras:number}>={};
  const entry=(day:string)=>result[day]??(result[day]={tasks:0,sales:0,sport:0,planned:0,important:0,done_important:0,extras:0,done_extras:0});
  for(const t of tasks||[]){const d=entry(t.day);d.planned++;if(t.completed)d.tasks++;if(t.priority==="important"){d.important++;if(t.completed)d.done_important++;}else{d.extras++;if(t.completed)d.done_extras++;}}
  for(const x of finances||[])if(x.direction==="income"&&x.is_sale)entry(x.day).sales++;
  for(const w of sports||[])entry(w.day).sport++;
  return out({ok:true,days:result,events:events||[]});
}
async function taskSave(db:DB,uid:number,b:any){
  const p=b.task||{},title=str(p.title,180),sphere=str(p.sphere,60,"Личное")||"Личное",notes=typeof p.notes==="string"?p.notes:"";
  if(!title||notes.length>6000||(p.day!==null&&!dateOK(p.day))||!["important","extra"].includes(p.priority))return out({error:"Неверные поля задачи"},400);
  const task={title,sphere,notes,day:p.day,priority:p.priority};
  if(b.goal_id!==undefined&&b.goal_id!==null){if(!uuid(b.goal_id))return out({error:"Неверная цель"},400);const goal=await must(db.from("ambitious_goals").select("id").eq("id",b.goal_id).eq("telegram_user_id",uid).maybeSingle());if(!goal)return out({error:"Цель не найдена"},404);}
  let id=b.id;
  if(id!==null&&id!==undefined&&!uuid(id))return out({error:"Неверный ID задачи"},400);
  if(id){const existing=await must(db.from("personal_tasks").select("day,completed").eq("id",id).eq("telegram_user_id",uid).maybeSingle());if(!existing)return out({error:"Задача не найдена"},404);
    await must(db.from("personal_tasks").update({...task,completed:existing.day===task.day?existing.completed:false,updated_at:new Date().toISOString()}).eq("id",id).eq("telegram_user_id",uid));
  }else{const row=await must(db.from("personal_tasks").insert({...task,telegram_user_id:uid}).select("id").single());id=row.id;}
  if(b.goal_id!==undefined){
    if(b.goal_id!==null&&!uuid(b.goal_id))return out({error:"Неверный ID цели"},400);
    await must(db.from("os6_task_goal").delete().eq("telegram_user_id",uid).eq("task_id",id));
    if(b.goal_id){const g=await must(db.from("ambitious_goals").select("id").eq("id",b.goal_id).eq("telegram_user_id",uid).maybeSingle());
      if(!g)return out({error:"Цель не найдена"},404);
      await must(db.from("os6_task_goal").insert({telegram_user_id:uid,task_id:id,goal_id:b.goal_id}));
    }
  }
  return out({ok:true,id});
}
async function focusAction(db:DB,uid:number,b:any){
  const command=b.command;
  const existing=await must(db.from("os6_focus").select("*").eq("telegram_user_id",uid).in("state",["running","paused"]).maybeSingle());
  const now=new Date(),nowIso=now.toISOString();
  if(command==="start"){
    if(existing)return out({error:"Заверши текущую фокус-сессию"},409);
    const taskId=uuid(b.task_id)?b.task_id:null;
    if(taskId){const owned=await must(db.from("personal_tasks").select("id").eq("telegram_user_id",uid).eq("id",taskId).maybeSingle());if(!owned)return out({error:"Задача не найдена"},404);}
    const result=await must(db.from("os6_focus").insert({telegram_user_id:uid,task_id:taskId,title:str(b.title,120,"Фокус")||"Фокус",started_at:nowIso,state:"running"}).select("*").single());return out({ok:true,item:result});
  }
  if(!existing)return out({error:"Нет активной фокус-сессии"},404);
  let changes:any={};
  if(command==="pause"&&existing.state==="running"){
    const seconds=Math.max(0,Math.floor((now.getTime()-new Date(existing.started_at).getTime())/1000));
    changes={state:"paused",started_at:null,accumulated_seconds:existing.accumulated_seconds+seconds};
  }else if(command==="resume"&&existing.state==="paused")changes={state:"running",started_at:nowIso};
  else if(command==="stop"){
    const seconds=existing.state==="running"?Math.max(0,Math.floor((now.getTime()-new Date(existing.started_at).getTime())/1000)):0;
    changes={state:"finished",started_at:null,finished_at:nowIso,accumulated_seconds:existing.accumulated_seconds+seconds};
  }else return out({error:"Неверное состояние таймера"},409);
  const data=await must(db.from("os6_focus").update(changes).eq("id",existing.id).eq("telegram_user_id",uid).select("*").single());return out({ok:true,item:data});
}
async function bootstrap(db:DB,uid:number,s:any){
  // Repeat generation occurs on authenticated launch, too, even if Supabase Cron did not run.
  await generateRepeats(db,uid,todayUTC(),14);
  const named=[
    ["links",db.from("os6_task_goal").select("task_id,goal_id").eq("telegram_user_id",uid).limit(1000)],
    ["repeats",db.from("os6_repeats").select("*").eq("telegram_user_id",uid).order("created_at",{ascending:false}).limit(250)],
    ["finance",db.from("os6_finance").select("*").eq("telegram_user_id",uid).order("day",{ascending:false}).limit(500)],
    ["workouts",db.from("os6_workouts").select("*").eq("telegram_user_id",uid).order("day",{ascending:false}).limit(300)],
    ["exercises",db.from("os6_exercises").select("*").eq("telegram_user_id",uid).limit(1000)],
    ["weight",db.from("os6_body_weight").select("*").eq("telegram_user_id",uid).order("day",{ascending:false}).limit(300)],
    ["focus",db.from("os6_focus").select("*").eq("telegram_user_id",uid).order("created_at",{ascending:false}).limit(300)],
    ["challenges",db.from("os6_challenges").select("*").eq("telegram_user_id",uid).order("created_at",{ascending:false}).limit(200)],
    ["challengeDays",db.from("os6_challenge_days").select("*").eq("telegram_user_id",uid).limit(1000)],
    ["reviews",db.from("os6_weekly_reviews").select("*").eq("telegram_user_id",uid).order("monday",{ascending:false}).limit(60)],
    ["kpiHistory",db.from("os6_kpi_history").select("*").eq("telegram_user_id",uid).order("effective_from",{ascending:false}).limit(100)]
  ] as const;
  const values=await Promise.all(named.map(async ([name,q])=>[name,await must(q)]));
  return out({ok:true,settings:s,...Object.fromEntries(values)});
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return out({error:"POST only"},405);
  try{
    const b=await req.json();if(!b||typeof b!=="object")return out({error:"Неверный запрос"},400);
    const user=b.initData ? await telegramUser(b.initData) : await verifyBrowserUser(b.browserSession);
    if(!user)return out({error:"Открой Mini App через Telegram повторно"},401);
    const allowed=Deno.env.get("TG_ALLOWED_USER_ID");if(allowed&&allowed!==String(user.id))return out({error:"Нет доступа"},403);
    const db=admin(),uid=user.id;
    const s=await ensureSettings(db,uid);
    const action=String(b.action||"");
    if(action==="bootstrap")return await bootstrap(db,uid,s);
    if(action==="metrics")return await metrics(db,uid,b);
    if(action==="calendar"){
      if(!dateOK(b.start)||!dateOK(b.end)||lengthDays(b.start,b.end)<0||lengthDays(b.start,b.end)>65)return out({error:"Неверный интервал"},400);
      const tasks=await must(db.from("personal_tasks").select("*").eq("telegram_user_id",uid).gte("day",b.start).lte("day",b.end).order("day").limit(1500));
      return out({ok:true,tasks});
    }
    if(action==="entity_save")return await entitySave(db,uid,b);
    if(action==="entity_delete")return await entityDelete(db,uid,b);
    if(action==="task_save_and_link")return await taskSave(db,uid,b);
    if(action==="task_reschedule"){
      if(!uuid(b.id)||!dateOK(b.day))return out({error:"Неверные параметры"},400);
      const old=await must(db.from("personal_tasks").select("day").eq("id",b.id).eq("telegram_user_id",uid).maybeSingle());
      if(!old)return out({error:"Задача не найдена"},404);
      await must(db.from("personal_tasks").update({day:b.day,completed:old.day===b.day?undefined:false,updated_at:new Date().toISOString()}).eq("id",b.id).eq("telegram_user_id",uid));
      return out({ok:true});
    }
    if(action==="settings_save"){
      const p=b.record||{};const tz=str(p.tz,64,"Europe/Moscow");
      try{new Intl.DateTimeFormat("en-US",{timeZone:tz}).format(new Date());}catch{return out({error:"Неизвестный часовой пояс"},400);}
      const time=(x:unknown):x is string=>typeof x==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
      if(!time(p.morning_time)||!time(p.evening_time)||!time(p.weekly_time))return out({error:"Неверное время"},400);
      const target_task=int(p.target_task,1,100000),target_sale=int(p.target_sale,1,100000),target_sport=int(p.target_sport,1,100000);
      if(target_task===null||target_sale===null||target_sport===null)return out({error:"Неверные KPI"},400);
      const changes={tz,morning_time:p.morning_time,evening_time:p.evening_time,weekly_time:p.weekly_time,reminders_enabled:p.reminders_enabled===true,target_task,target_sale,target_sport,updated_at:new Date().toISOString()};
      await must(db.from("os6_settings").update(changes).eq("telegram_user_id",uid));
      if(s.target_task!==target_task||s.target_sale!==target_sale||s.target_sport!==target_sport){
        await must(db.from("os6_kpi_history").upsert({telegram_user_id:uid,effective_from:todayUTC(),target_task,target_sale,target_sport},{onConflict:"telegram_user_id,effective_from"}));
      }
      return out({ok:true});
    }
    if(action==="challenge_day"){
      if(!uuid(b.id)||!dateOK(b.day))return out({error:"Неверные параметры"},400);
      const challenge=await must(db.from("os6_challenges").select("starts_on,ends_on").eq("id",b.id).eq("telegram_user_id",uid).maybeSingle());
      if(!challenge)return out({error:"Вызов не найден"},404);
      if(b.day<challenge.starts_on||b.day>challenge.ends_on||b.day>todayUTC())return out({error:"Этот день вне периода"},400);
      if(b.done===true)await must(db.from("os6_challenge_days").upsert({telegram_user_id:uid,challenge_id:b.id,day:b.day},{onConflict:"telegram_user_id,challenge_id,day"}));
      else await must(db.from("os6_challenge_days").delete().eq("telegram_user_id",uid).eq("challenge_id",b.id).eq("day",b.day));
      return out({ok:true});
    }
    if(action==="focus")return await focusAction(db,uid,b);
    if(action==="review_save"){
      if(!dateOK(b.monday)||!monday(b.monday))return out({error:"Начало недели — понедельник"},400);
      const row={telegram_user_id:uid,monday:b.monday,wins:str(b.wins,3000),lessons:str(b.lessons,3000),next_steps:str(b.next_steps,3000),updated_at:new Date().toISOString()};
      await must(db.from("os6_weekly_reviews").upsert(row,{onConflict:"telegram_user_id,monday"}));return out({ok:true});
    }
    return out({error:"Неизвестное действие"},400);
  }catch(err){console.error("OS6:",err);return out({error:"Ошибка сервера. Проверь миграцию и логи Edge Function."},500);}
});
