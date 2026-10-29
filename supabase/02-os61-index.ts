// Personal OS 6.1, Edge Function name: os61
// New categories, task ordering and reliable account-local date.
// Never expose service role credentials. Verify JWT OFF, Telegram initData checked below.
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_ORIGIN = "https://vanyamars.github.io";
const CORS = {"Access-Control-Allow-Origin":SITE_ORIGIN,"Access-Control-Allow-Headers":"content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:CORS});
const encode=new TextEncoder();
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const ymd=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&
  !Number.isNaN(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
function validTz(tz:unknown):tz is string{
  if(typeof tz!=="string"||tz.length>64||tz.length<3)return false;
  try{new Intl.DateTimeFormat("en",{timeZone:tz}).format();return true;}catch{return false;}
}
function todayAt(tz:string){const p=new Intl.DateTimeFormat("en-GB",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(k:string)=>p.find(x=>x.type===k)?.value||"";return `${get("year")}-${get("month")}-${get("day")}`;}
function admin(){const url=Deno.env.get("SUPABASE_URL")||"";const raw=Deno.env.get("SUPABASE_SECRET_KEYS")||"";
  let key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  try{key=JSON.parse(raw).default||key;}catch{/* legacy key */}
  if(!url||!key)throw Error("Missing database configuration");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function verifyTelegram(raw:string):Promise<number|null>{
  const token=Deno.env.get("TG_BOT_TOKEN")||"";
  if(!token||!raw||raw.length>8192)return null;
  try{
    const data=new URLSearchParams(raw), hash=data.get("hash")||"";
    if(!/^[0-9a-f]{64}$/i.test(hash))return null;
    const age=Math.floor(Date.now()/1000)-Number(data.get("auth_date"));
    if(!Number.isFinite(age)||age< -60||age>86400)return null;
    const check=[...data.entries()].filter(([k])=>k!=="hash").sort(([a],[b])=>a.localeCompare(b))
      .map(([k,v])=>`${k}=${v}`).join("\n");
    const k1=await crypto.subtle.importKey("raw",encode.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const secret=await crypto.subtle.sign("HMAC",k1,encode.encode(token));
    const k2=await crypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const signature=new Uint8Array(await crypto.subtle.sign("HMAC",k2,encode.encode(check)));
    const incoming=Uint8Array.from(hash.match(/.{2}/g)!.map(s=>parseInt(s,16)));
    let diff=signature.length^incoming.length;for(let i=0;i<signature.length;i++)diff|=signature[i]^incoming[i];
    if(diff)return null;
    const user=JSON.parse(data.get("user")||"null");
    return Number.isSafeInteger(user?.id)&&user.id>0?user.id:null;
  }catch{return null;}
}
async function must<T>(p:PromiseLike<{data:T;error:any}>):Promise<T>{const r=await p;if(r.error)throw r.error;return r.data;}
const colors=new Set(["#8B84ED","#75B9EC","#E8A277","#69BFA7","#E6A9C4","#9B9BAF","#E0B55E","#90A9D7"]);
const icons=new Set(["folder","briefcase","house","heart-pulse","wallet","dumbbell","book-open","sparkles","graduation-cap","car","shopping-bag","palette","target","users","check-circle"]);
const defaults=[
  {name:"Работа",icon:"briefcase",color:"#8B84ED"},
  {name:"Быт",icon:"house",color:"#75B9EC"},
  {name:"Финансы",icon:"wallet",color:"#E8A277"},
  {name:"Здоровье",icon:"heart-pulse",color:"#69BFA7"},
  {name:"Обучение",icon:"book-open",color:"#E6A9C4"},
  {name:"Личное",icon:"sparkles",color:"#9B9BAF"}
];
const dateAdd=(s:string,n:number)=>new Date(Date.parse(s+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
function repeatMatches(r:any,day:string){
  if(!r.enabled||day<r.starts_on||(r.ends_on&&day>r.ends_on))return false;
  const gap=Math.round((Date.parse(day+"T12:00:00Z")-Date.parse(r.starts_on+"T12:00:00Z"))/86400000);
  const interval=Number(r.interval_n)||1;
  if(r.frequency==="daily")return gap%interval===0;
  if(r.frequency==="weekly"){
    const iso=new Date(day+"T12:00:00Z").getUTCDay()||7;
    return Array.isArray(r.weekdays)&&r.weekdays.includes(iso)&&Math.floor(gap/7)%interval===0;
  }
  if(r.frequency==="monthly"){
    const a=new Date(r.starts_on+"T12:00:00Z"),b=new Date(day+"T12:00:00Z");
    const months=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth();
    const endDay=new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth()+1,0)).getUTCDate();
    return months>=0&&months%interval===0&&b.getUTCDate()===Math.min(a.getUTCDate(),endDay);
  }
  return false;
}
async function ensureLocalRepeats(db:ReturnType<typeof createClient>,uid:number,tz:string){
  const starts=todayAt(tz);const r=await must(db.from("os6_repeats").select("*").eq("telegram_user_id",uid).eq("enabled",true).limit(200));
  const insert:any[]=[];for(let i=0;i<14;i++){const day=dateAdd(starts,i);for(const rule of r||[]){
    if(repeatMatches(rule,day))insert.push({telegram_user_id:uid,title:rule.title,notes:"",sphere:rule.sphere,day,priority:rule.priority,completed:false,os6_repeat_id:rule.id});
  }}
  if(insert.length){const res=await db.from("personal_tasks").upsert(insert,{onConflict:"telegram_user_id,os6_repeat_id,day",ignoreDuplicates:true});
    if(res.error)throw res.error;}
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return json({error:"POST only"},405);
  try{
    let b:any;try{b=await req.json();}catch{return json({error:"Invalid JSON"},400);}
    const uid=await verifyTelegram(String(b?.initData||""));
    if(!uid)return json({error:"Открой приложение через Telegram повторно"},401);
    const allowed=Deno.env.get("TG_ALLOWED_USER_ID");if(allowed&&allowed!==String(uid))return json({error:"Доступ закрыт"},403);
    const db=admin();const action=String(b?.action||"");
    if(action==="bootstrap"){
      const settings=await must(db.from("os6_settings").select("tz").eq("telegram_user_id",uid).maybeSingle());
      if(!settings)return json({error:"Сначала установи и открой Personal OS 6.0"},409);
      const oldPref=await must(db.from("os61_preferences").select("*").eq("telegram_user_id",uid).maybeSingle());
      let tz=settings.tz;
      if(!oldPref){
        // Older v6 users may have the factory default Europe/Berlin;
        // prefer the Telegram device's local IANA time zone once.
        if(tz==="Europe/Berlin"&&validTz(b.deviceTimezone))tz=b.deviceTimezone;
        await must(db.from("os61_preferences").upsert({telegram_user_id:uid,tz_initialized:true},{onConflict:"telegram_user_id"}));
        if(tz!==settings.tz)await must(db.from("os6_settings").update({tz,updated_at:new Date().toISOString()}).eq("telegram_user_id",uid));
      }
      await ensureLocalRepeats(db,uid,tz);
      let cats=await must(db.from("os61_categories").select("*").eq("telegram_user_id",uid).order("sort_order").order("created_at"));
      if(!cats?.length){
        const seeded=await db.from("os61_categories").insert(defaults.map((c,i)=>({...c,telegram_user_id:uid,sort_order:(i+1)*100})));
        if(seeded.error&&seeded.error.code!=="23505")throw seeded.error;
        cats=await must(db.from("os61_categories").select("*").eq("telegram_user_id",uid).order("sort_order").order("created_at"));
      }
      return json({ok:true,tz,today:todayAt(tz),serverNow:new Date().toISOString(),categories:cats});
    }
    if(action==="timezone_save"){
      if(!validTz(b.tz))return json({error:"Укажи корректный часовой пояс IANA"},400);
      await must(db.from("os6_settings").update({tz:b.tz,updated_at:new Date().toISOString()}).eq("telegram_user_id",uid));
      await must(db.from("os61_preferences").upsert({telegram_user_id:uid,tz_initialized:true},{onConflict:"telegram_user_id"}));
      return json({ok:true,tz:b.tz,today:todayAt(b.tz)});
    }
    if(action==="category_save"){
      const name=typeof b.name==="string"?b.name.trim():"",color=b.color,icon=b.icon;
      if(!name||name.length>60||!colors.has(color)||!icons.has(icon))return json({error:"Проверь название, цвет и иконку"},400);
      if(b.id){
        if(!uuid(b.id))return json({error:"Неверный ID категории"},400);
        const r=await db.rpc("os61_rename_category",{p_uid:uid,p_id:b.id,p_name:name,p_color:color,p_icon:icon});
        if(r.error){if(r.error.code==="23505")return json({error:"Такая категория уже есть"},409);throw r.error;}
        return json({ok:true});
      }
      const r=await db.from("os61_categories").insert({telegram_user_id:uid,name,color,icon,sort_order:Date.now()%2147483647}).select("id").single();
      if(r.error){if(r.error.code==="23505")return json({error:"Такая категория уже есть"},409);throw r.error;}
      return json({ok:true,id:r.data?.id});
    }
    if(action==="category_delete"){
      if(!uuid(b.id))return json({error:"Неверный ID категории"},400);
      await must(db.rpc("os61_remove_category",{p_uid:uid,p_id:b.id}));
      return json({ok:true});
    }
    if(action==="category_reorder"){
      if(!Array.isArray(b.ids)||b.ids.length>100||b.ids.some((id:any)=>!uuid(id))||new Set(b.ids).size!==b.ids.length)
        return json({error:"Неверный список категорий"},400);
      const owned=await must(db.from("os61_categories").select("id").eq("telegram_user_id",uid));
      const set=new Set(owned.map((c:any)=>c.id));if(b.ids.some((id:string)=>!set.has(id)))return json({error:"Категория не найдена"},404);
      for(let i=0;i<b.ids.length;i++)await must(db.from("os61_categories").update({sort_order:(i+1)*100}).eq("id",b.ids[i]).eq("telegram_user_id",uid));
      return json({ok:true});
    }
    if(action==="task_category_set"){
      if(!uuid(b.id)||(b.categoryId!==null&&!uuid(b.categoryId)))return json({error:"Неверный ID"},400);
      let cat:any=null;
      if(b.categoryId){cat=await must(db.from("os61_categories").select("id,name").eq("id",b.categoryId).eq("telegram_user_id",uid).maybeSingle());
        if(!cat)return json({error:"Категория не найдена"},404);
      }
      const task=await must(db.from("personal_tasks").update({os61_category_id:cat?.id||null,sphere:cat?.name||"Без категории"})
        .eq("id",b.id).eq("telegram_user_id",uid).select("id").maybeSingle());
      if(!task)return json({error:"Задача не найдена"},404);
      return json({ok:true});
    }
    if(action==="task_reorder"){
      const rows=b.items;
      if(!Array.isArray(rows)||rows.length>400)return json({error:"Слишком много задач"},400);
      if(rows.some((r:any)=>!uuid(r.id)||!['important','extra'].includes(r.priority)||
        (r.day!==null&&!ymd(r.day))||!Number.isSafeInteger(r.position)||r.position<0||r.position>1e9))return json({error:"Неверные значения сортировки"},400);
      const r=await db.rpc("os61_apply_task_order",{p_uid:uid,p_items:rows});if(r.error)throw r.error;
      return json({ok:true});
    }
    if(action==="challenge_day"){
      if(!uuid(b.id)||!ymd(b.day)||typeof b.done!=="boolean")return json({error:"Некорректные параметры"},400);
      const tz=(await must(db.from("os6_settings").select("tz").eq("telegram_user_id",uid).single())).tz;
      const row=await must(db.from("os6_challenges").select("starts_on,ends_on").eq("id",b.id).eq("telegram_user_id",uid).maybeSingle());
      if(!row)return json({error:"Вызов не найден"},404);
      if(b.day<row.starts_on||b.day>row.ends_on||b.day>todayAt(tz))return json({error:"Дата за пределами вызова"},400);
      if(b.done)await must(db.from("os6_challenge_days").upsert({telegram_user_id:uid,challenge_id:b.id,day:b.day},{onConflict:"telegram_user_id,challenge_id,day"}));
      else await must(db.from("os6_challenge_days").delete().eq("telegram_user_id",uid).eq("challenge_id",b.id).eq("day",b.day));
      return json({ok:true});
    }
    return json({error:"Неизвестная операция"},400);
  }catch(err){console.error("os61",err);return json({error:"Ошибка сервера. Проверь миграцию 6.1 и логи os61."},500);}
});
