// Personal OS 6.4: earnings for task pages. Verify JWT OFF only with Telegram HMAC verification intact.
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
const currencyOk=(s:string)=>['RUB','USD','EUR'].includes(s);
const dateOk=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'));
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({ok:false,error:'POST required'},405);
 try{
  const body=await req.json();const uid=await verify(String(body?.initData||''));
  if(!uid)return reply({ok:false,error:'Telegram authorization failed'},401);
  const allowed=Deno.env.get('TG_ALLOWED_USER_ID');if(allowed&&allowed!==String(uid))return reply({ok:false,error:'Access denied'},403);
  const db=admin(),act=String(body.action||'');
  if(act==='archived_pages'){
   const rows=await must(db.from('os9_task_page_archive').select('page_id').eq('telegram_user_id',uid).limit(10000));
   return reply({ok:true,pageIds:rows.map((r:any)=>r.page_id)});
  }
  if(act==='regular_goal_get'||act==='regular_goal_set'){
   if(!idOk(body.taskId))return reply({ok:false,error:'Неверный ID задачи'},400);
   const task=await must(db.from('personal_tasks').select('id').eq('telegram_user_id',uid).eq('id',body.taskId).maybeSingle());
   if(!task)return reply({ok:false,error:'Задача не найдена'},404);
   if(act==='regular_goal_get'){
     const record=await must(db.from('os9_regular_goal_tasks').select('goal_id').eq('telegram_user_id',uid).eq('task_id',body.taskId).maybeSingle());
     return reply({ok:true,goalId:record?.goal_id||null});
   }
   const goalId=body.goalId||null;
   if(goalId!==null){if(!idOk(goalId))return reply({ok:false,error:'Неверный ID цели'},400);
     const goal=await must(db.from('os8_regular_goals').select('id').eq('telegram_user_id',uid).eq('id',goalId).maybeSingle());
     if(!goal)return reply({ok:false,error:'Цель не найдена'},404);
     await must(db.from('os9_regular_goal_tasks').upsert({telegram_user_id:uid,task_id:body.taskId,goal_id:goalId},{onConflict:'telegram_user_id,task_id'}).select('task_id').single());
   }else await must(db.from('os9_regular_goal_tasks').delete().eq('telegram_user_id',uid).eq('task_id',body.taskId));
   return reply({ok:true});
  }
  if(act==='regular_goal_stats'){
   const links=await must(db.from('os9_regular_goal_tasks').select('goal_id,task_id').eq('telegram_user_id',uid).limit(5000));
   const stats:Record<string,{total:number;done:number}>={};
   for(const l of links){stats[l.goal_id]??={total:0,done:0};stats[l.goal_id].total++;}
   for(let i=0;i<links.length;i+=150){const ids=links.slice(i,i+150).map((l:any)=>l.task_id);
     const tasks=await must(db.from('personal_tasks').select('id,completed').eq('telegram_user_id',uid).in('id',ids));
     for(const t of tasks){const link=links.find((l:any)=>l.task_id===t.id);if(link&&t.completed)stats[link.goal_id].done++;}
   }
   if(links.length===5000)return reply({ok:false,error:'Слишком много связей; необходимо ограничить запрос'},413);
   return reply({ok:true,stats});
  }
  if(act==='income_get'||act==='income_save'){
   if(!idOk(body.taskId))return reply({ok:false,error:'Некорректный ID задачи'},400);
   const task=await must(db.from('personal_tasks').select('id').eq('telegram_user_id',uid).eq('id',body.taskId).maybeSingle());
   if(!task)return reply({ok:false,error:'Задача не найдена'},404);
   if(act==='income_get'){
    const income=await must(db.from('os9_task_income').select('amount,currency,confirmed,earned_on').eq('telegram_user_id',uid).eq('task_id',body.taskId).maybeSingle());
    return reply({ok:true,income});
   }
   const amount=Number(body.amount);const currency=String(body.currency||'RUB');
   const confirmed=body.confirmed===true;const earnedOn=body.earned_on||null;
   if(!Number.isFinite(amount)||amount<0||amount>999999999||Math.abs(Math.round(amount*100)-amount*100)>0.000001||!currencyOk(currency))return reply({ok:false,error:'Проверь сумму и валюту'},400);
   if(earnedOn!==null&&!dateOk(earnedOn))return reply({ok:false,error:'Некорректная дата дохода'},400);
   if(confirmed&&(amount===0||!earnedOn))return reply({ok:false,error:'Для полученного дохода укажи сумму и дату'},400);
   await must(db.from('os9_task_income').upsert({telegram_user_id:uid,task_id:body.taskId,amount,currency,confirmed,earned_on:confirmed?earnedOn:null,updated_at:new Date().toISOString()},{onConflict:'telegram_user_id,task_id'}).select('task_id').single());
   return reply({ok:true});
  }
  if(act==='income_summary'){
   const start=body.start,end=body.end;
   if(!dateOk(start)||!dateOk(end)||start>end||Date.parse(end)-Date.parse(start)>370*86400000)return reply({ok:false,error:'Выбери период до 370 дней'},400);
   const totals:Record<string,number>={},daily:Record<string,Record<string,number>>={};let count=0;
   // The date and confirmed flag are independent of task due date/completion.
   const rows=await must(db.from('os9_task_income').select('amount,currency,earned_on').eq('telegram_user_id',uid).eq('confirmed',true).gte('earned_on',start).lte('earned_on',end).order('earned_on').limit(5000));
   for(const row of rows){const amount=Number(row.amount),currency=String(row.currency),day=String(row.earned_on);if(!Number.isFinite(amount)||!currencyOk(currency))continue;
     totals[currency]=(totals[currency]||0)+amount;
     daily[day]??={};daily[day][currency]=(daily[day][currency]||0)+amount;count++;
   }
   if(rows.length===5000)return reply({ok:false,error:'Слишком много операций за период. Выбери меньший срок.'},413);
   return reply({ok:true,totals,daily,count});
  }
  return reply({ok:false,error:'Unknown action'},400);
 }catch(e:any){console.error('os9 request failed',String(e?.message||e));return reply({ok:false,error:'Не удалось выполнить запрос'},500)}
});
