// Personal OS Workspace. New separate Edge Function "os7". Verify JWT OFF ONLY if Telegram initData HMAC validation remains intact.
import {createClient} from "npm:@supabase/supabase-js@2";

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

const tables = {pages:'os7_pages',blocks:'os7_blocks',sources:'os7_data_sources',fields:'os7_fields',records:'os7_records',views:'os7_views',splits:'os7_splits',items:'os7_workflow_items'};
const kinds = new Set(['text','heading','checklist','image','divider','database','pipeline','page_link']);
const fieldTypes = new Set(['text','number','status','date','checkbox','select','relation']);
const viewTypes = new Set(['table','board','list','calendar']);
const safeText=(x:unknown,max:number)=>typeof x==='string'?x.trim().slice(0,max):'';
const positive=(x:unknown,max=1e9)=>Number.isInteger(x)&&Number(x)>=0&&Number(x)<=max;
const validId=(id:unknown)=>uuid(id);
const fail=(s:string,status=400)=>json({ok:false,error:s},status);
const cleanObj=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
async function ownerRow(db:any,table:string,uid:number,id:string){return must(db.from(table).select('*').eq('telegram_user_id',uid).eq('id',id).maybeSingle());}
async function position(db:any,table:string,uid:number,parentKey:string,parentId:string){const r=await must(db.from(table).select('position').eq('telegram_user_id',uid).eq(parentKey,parentId).order('position',{ascending:false}).limit(1));return (Number(r?.[0]?.position)||0)+1000;}
async function sorted(db:any,table:string,uid:number,parentKey:string,parentId:string){return must(db.from(table).select('*').eq('telegram_user_id',uid).eq(parentKey,parentId).order('position').order('created_at',{ascending:true}));}
async function setOrder(db:any,table:string,uid:number,parentKey:string,parentId:string,ids:any){
  if(!Array.isArray(ids)||ids.length>500||ids.some((id:any)=>!validId(id))||new Set(ids).size!==ids.length)throw Error('Неверный порядок элементов');
  const rows=await must(db.from(table).select('id').eq('telegram_user_id',uid).eq(parentKey,parentId));
  if(rows.length!==ids.length||rows.some((r:any)=>!ids.includes(r.id)))throw Error('Порядок должен содержать все элементы списка');
  for(let i=0;i<ids.length;i++)await must(db.from(table).update({position:(i+1)*1000}).eq('telegram_user_id',uid).eq(parentKey,parentId).eq('id',ids[i]));
}
function safeContent(type:string,value:unknown){
  const v=cleanObj(value);const result:Record<string,unknown>={};
  if(['text','heading','checklist'].includes(type)){result.text=safeText(v.text,12000);if(type==='checklist')result.checked=v.checked===true;}
  if(type==='image'){const src=safeText(v.url,1800);if(src&&!/^https:\/\//i.test(src))throw Error('Изображение должно иметь HTTPS-адрес');result.url=src;result.alt=safeText(v.alt,200);}
  if(type==='database'){if(!validId(v.sourceId))throw Error('Выбери базу данных');result.sourceId=v.sourceId;}
  if(type==='page_link'){if(!validId(v.pageId))throw Error('Выбери страницу');result.pageId=v.pageId;}
  if(type==='pipeline')result.title=safeText(v.title,150)||'Pipeline';
  return result;
}
function normalizeValue(field:any,val:unknown){
  if(val===null||val===undefined||val==='')return null;
  if(field.field_type==='checkbox')return val===true;
  if(field.field_type==='number'){const n=Number(val);if(!Number.isFinite(n)||Math.abs(n)>1e12)throw Error('Неверное число в поле '+field.name);return n;}
  if(field.field_type==='date'){if(!ymd(val))throw Error('Неверная дата в поле '+field.name);return val;}
  if(field.field_type==='relation'){if(!validId(val))throw Error('Неверная ссылка в поле '+field.name);return val;}
  const str=safeText(val,600);if(!str)return null;
  if(['status','select'].includes(field.field_type)){
    const options=cleanObj(field.options);if(Array.isArray(options.choices)&&options.choices.length&&!options.choices.includes(str))throw Error('Недопустимое значение '+field.name);
  }
  return str;
}
async function validatedProperties(db:any,uid:number,sourceId:string,payload:unknown){
  const vals=cleanObj(payload);const fields=await must(db.from('os7_fields').select('*').eq('telegram_user_id',uid).eq('source_id',sourceId));
  if(Object.keys(vals).length>120)throw Error('Слишком много полей');
  const output:Record<string,unknown>={};
  for(const [key,value] of Object.entries(vals)){
    const field=fields.find((f:any)=>f.id===key);if(!field)throw Error('Поле не принадлежит базе');
    output[key]=normalizeValue(field,value);
    if(field.field_type==='relation'&&output[key]){
      const opt=cleanObj(field.options);const target=opt.targetSourceId;
      if(!validId(target))throw Error('Для поля Relation не задана целевая база');
      const existing=await must(db.from('os7_records').select('id').eq('telegram_user_id',uid).eq('source_id',target).eq('id',output[key]).maybeSingle());
      if(!existing)throw Error('Связанная запись не найдена');
    }
  }
  return output;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(req.method!=='POST')return fail('POST only',405);
 try{
  if(req.headers.get('content-length')&&Number(req.headers.get('content-length'))>60000)return fail('Слишком большой запрос',413);
  let b:any;try{b=await req.json();}catch{return fail('Некорректный JSON')}
  const uid=await verifyTelegram(String(b?.initData||''));if(!uid)return fail('Открой Mini App через Telegram',401);
  const allowed=Deno.env.get('TG_ALLOWED_USER_ID');if(allowed&&allowed!==String(uid))return fail('Доступ закрыт',403);
  const db=admin(),act=String(b?.action||'');
  if(act==='bootstrap'){
    const [pages,sources,recordPages]=await Promise.all([
      must(db.from(tables.pages).select('id,parent_id,title,icon,updated_at').eq('telegram_user_id',uid).order('updated_at',{ascending:false}).limit(500)),
      must(db.from(tables.sources).select('id,name,updated_at').eq('telegram_user_id',uid).order('updated_at',{ascending:false}).limit(300)),
      must(db.from(tables.records).select('page_id').eq('telegram_user_id',uid).limit(2000))]);
    return json({ok:true,pages,sources,recordPageIds:recordPages.map((x:any)=>x.page_id)});
  }
  if(act==='page_get'){
    if(!validId(b.id))return fail('Неверный ID страницы');
    const page=await ownerRow(db,tables.pages,uid,b.id);if(!page)return fail('Страница не найдена',404);
    const blocks=await sorted(db,tables.blocks,uid,'page_id',b.id);
    const pipeIds=blocks.filter((r:any)=>r.type==='pipeline').map((r:any)=>r.id);
    let splits:any[]=[],items:any[]=[];
    if(pipeIds.length){splits=await must(db.from(tables.splits).select('*').eq('telegram_user_id',uid).in('block_id',pipeIds).order('position'));
      if(splits.length)items=await must(db.from(tables.items).select('*').eq('telegram_user_id',uid).in('split_id',splits.map((x:any)=>x.id)).order('position'));
    }
    const record=await must(db.from(tables.records).select('id,source_id,title,properties').eq('telegram_user_id',uid).eq('page_id',b.id).maybeSingle());
    return json({ok:true,page,blocks,splits,items,record});
  }
  if(act==='page_save'){
    const name=safeText(b.title,180)||'Без названия',icon=safeText(b.icon,24)||'📄';
    if(b.parentId!==null&&b.parentId!==undefined&&!validId(b.parentId))return fail('Неверная родительская страница');
    const parent=b.parentId||null;
    if(parent){const p=await ownerRow(db,tables.pages,uid,parent);if(!p)return fail('Родительская страница не найдена',404);}
    if(b.id){if(!validId(b.id))return fail('Неверный ID');const own=await ownerRow(db,tables.pages,uid,b.id);if(!own)return fail('Страница не найдена',404);
      if(parent){let next=parent;const seen=new Set<string>();for(let step=0;next&&step<100;step++){
        if(step>=99||next===b.id||seen.has(next))return fail('Цикл или слишком большая глубина страниц');seen.add(next);
        const current=await ownerRow(db,tables.pages,uid,next);next=current?.parent_id||null;
      }}
      await must(db.from(tables.pages).update({title:name,icon,parent_id:parent,updated_at:new Date().toISOString()}).eq('id',b.id).eq('telegram_user_id',uid));
      await must(db.from(tables.records).update({title:name,updated_at:new Date().toISOString()}).eq('telegram_user_id',uid).eq('page_id',b.id));return json({ok:true,id:b.id});
    }
    const row=await must(db.from(tables.pages).insert({telegram_user_id:uid,title:name,icon,parent_id:parent}).select('id').single());return json({ok:true,id:row.id});
  }
  if(act==='page_delete'){
    if(!validId(b.id))return fail('Неверный ID');const row=await ownerRow(db,tables.pages,uid,b.id);if(!row)return fail('Страница не найдена',404);
    await must(db.from(tables.pages).delete().eq('telegram_user_id',uid).eq('id',b.id));return json({ok:true});
  }
  if(act==='block_save'){
    if(!validId(b.pageId)||!kinds.has(b.type))return fail('Неверный тип блока или страница');
    if(!await ownerRow(db,tables.pages,uid,b.pageId))return fail('Страница не найдена',404);
    const content=safeContent(b.type,b.content);
    if(b.type==='database'&&!await ownerRow(db,tables.sources,uid,content.sourceId as string))return fail('База данных не найдена',404);
    if(b.type==='page_link'&&!await ownerRow(db,tables.pages,uid,content.pageId as string))return fail('Ссылка ведёт на чужую страницу',404);
    if(b.id){const old=validId(b.id)?await ownerRow(db,tables.blocks,uid,b.id):null;if(!old||old.page_id!==b.pageId)return fail('Блок не найден',404);
      if(old.type==='pipeline'&&b.type!=='pipeline')return fail('Нельзя менять тип блока Pipeline без удаления');
      await must(db.from(tables.blocks).update({content,updated_at:new Date().toISOString()}).eq('id',b.id).eq('telegram_user_id',uid));return json({ok:true,id:b.id});
    }
    const pos=await position(db,tables.blocks,uid,'page_id',b.pageId);
    const row=await must(db.from(tables.blocks).insert({telegram_user_id:uid,page_id:b.pageId,type:b.type,content,position:pos}).select('id').single());
    return json({ok:true,id:row.id});
  }
  if(act==='block_delete'){
    const row=validId(b.id)?await ownerRow(db,tables.blocks,uid,b.id):null;if(!row)return fail('Блок не найден',404);
    await must(db.from(tables.blocks).delete().eq('id',b.id).eq('telegram_user_id',uid));return json({ok:true});
  }
  if(act==='block_reorder'){
    if(!validId(b.pageId))return fail('Неверная страница');await setOrder(db,tables.blocks,uid,'page_id',b.pageId,b.ids);return json({ok:true});
  }
  if(act==='source_save'){
    const name=safeText(b.name,180);if(!name)return fail('Название базы обязательно');
    if(b.id){const row=validId(b.id)?await ownerRow(db,tables.sources,uid,b.id):null;if(!row)return fail('База не найдена',404);
      await must(db.from(tables.sources).update({name,updated_at:new Date().toISOString()}).eq('id',b.id).eq('telegram_user_id',uid));return json({ok:true,id:b.id});}
    const src=await must(db.from(tables.sources).insert({telegram_user_id:uid,name}).select('id').single());
    await must(db.from(tables.fields).insert([{telegram_user_id:uid,source_id:src.id,name:'Статус',field_type:'status',options:{choices:['К работе','В процессе','Готово']},position:1000},{telegram_user_id:uid,source_id:src.id,name:'Дата',field_type:'date',options:{},position:2000}]));
    await must(db.from(tables.views).insert(['table','board','list','calendar'].map((kind,i)=>({telegram_user_id:uid,source_id:src.id,name:({table:'Таблица',board:'Доска',list:'Список',calendar:'Календарь'} as Record<string,string>)[kind],view_type:kind,config:{},position:(i+1)*1000}))));
    return json({ok:true,id:src.id});
  }
  if(act==='source_get'){
    if(!validId(b.id))return fail('Неверный ID базы');const source=await ownerRow(db,tables.sources,uid,b.id);if(!source)return fail('База не найдена',404);
    const offset=positive(b.offset,200000)?Number(b.offset):0;
    const [fields,views,records]=await Promise.all([
      sorted(db,tables.fields,uid,'source_id',b.id),sorted(db,tables.views,uid,'source_id',b.id),
      must(db.from(tables.records).select('*').eq('telegram_user_id',uid).eq('source_id',b.id).order('created_at',{ascending:false}).range(offset,offset+199))]);
    return json({ok:true,source,fields,views,records,offset,hasMore:records.length===200});
  }
  if(act==='source_delete'){
    const row=validId(b.id)?await ownerRow(db,tables.sources,uid,b.id):null;if(!row)return fail('База не найдена',404);
    const all=await must(db.from(tables.records).select('page_id').eq('telegram_user_id',uid).eq('source_id',b.id).limit(10000));
    await must(db.from(tables.sources).delete().eq('telegram_user_id',uid).eq('id',b.id));
    if(all.length)await must(db.from(tables.pages).delete().eq('telegram_user_id',uid).in('id',all.map((r:any)=>r.page_id)));
    return json({ok:true});
  }
  if(act==='field_save'){
    const source=validId(b.sourceId)?await ownerRow(db,tables.sources,uid,b.sourceId):null;if(!source)return fail('База не найдена',404);
    const name=safeText(b.name,80),kind=String(b.fieldType||'text');if(!name||!fieldTypes.has(kind))return fail('Неверное поле');
    const opt=cleanObj(b.options);if(JSON.stringify(opt).length>4000)return fail('Слишком большие настройки поля');
    if(['status','select'].includes(kind)){
      if(!Array.isArray(opt.choices)||opt.choices.length>50||opt.choices.some((x:any)=>typeof x!=='string'||x.length>80))return fail('Неверные варианты выбора');
    }
    if(kind==='relation'&&(!validId(opt.targetSourceId)||!await ownerRow(db,tables.sources,uid,String(opt.targetSourceId))))return fail('Выбери связанную базу');
    if(b.id){const row=validId(b.id)?await ownerRow(db,tables.fields,uid,b.id):null;if(!row||row.source_id!==b.sourceId)return fail('Поле не найдено',404);
      await must(db.from(tables.fields).update({name,field_type:kind,options:opt}).eq('telegram_user_id',uid).eq('id',b.id));return json({ok:true,id:b.id});}
    const pos=await position(db,tables.fields,uid,'source_id',b.sourceId);
    const row=await must(db.from(tables.fields).insert({telegram_user_id:uid,source_id:b.sourceId,name,field_type:kind,options:opt,position:pos}).select('id').single());return json({ok:true,id:row.id});
  }
  if(act==='field_delete'){
    const row=validId(b.id)?await ownerRow(db,tables.fields,uid,b.id):null;if(!row)return fail('Поле не найдено',404);
    await must(db.from(tables.fields).delete().eq('telegram_user_id',uid).eq('id',b.id));return json({ok:true});
  }
  if(act==='view_save'){
    const source=validId(b.sourceId)?await ownerRow(db,tables.sources,uid,b.sourceId):null;if(!source)return fail('База не найдена',404);
    const name=safeText(b.name,80),kind=String(b.viewType);if(!name||!viewTypes.has(kind))return fail('Неверное представление');
    const config=cleanObj(b.config);if(JSON.stringify(config).length>4000)return fail('Слишком большие настройки');
    if(b.id){const row=validId(b.id)?await ownerRow(db,tables.views,uid,b.id):null;if(!row||row.source_id!==b.sourceId)return fail('Представление не найдено',404);
      await must(db.from(tables.views).update({name,view_type:kind,config}).eq('id',b.id).eq('telegram_user_id',uid));return json({ok:true,id:b.id});}
    const pos=await position(db,tables.views,uid,'source_id',b.sourceId);
    const row=await must(db.from(tables.views).insert({telegram_user_id:uid,source_id:b.sourceId,name,view_type:kind,config,position:pos}).select('id').single());return json({ok:true,id:row.id});
  }
  if(act==='view_delete'){
    const row=validId(b.id)?await ownerRow(db,tables.views,uid,b.id):null;if(!row)return fail('Представление не найдено',404);
    const views=await must(db.from(tables.views).select('id').eq('telegram_user_id',uid).eq('source_id',row.source_id));
    if(views.length<2)return fail('Нельзя удалить последнее представление');
    await must(db.from(tables.views).delete().eq('telegram_user_id',uid).eq('id',b.id));return json({ok:true});
  }
  if(act==='record_save'){
    const source=validId(b.sourceId)?await ownerRow(db,tables.sources,uid,b.sourceId):null;if(!source)return fail('База не найдена',404);
    const title=safeText(b.title,180)||'Новая запись';const properties=await validatedProperties(db,uid,b.sourceId,b.properties);
    if(b.id){const record=validId(b.id)?await ownerRow(db,tables.records,uid,b.id):null;if(!record||record.source_id!==b.sourceId)return fail('Запись не найдена',404);
      await must(db.from(tables.records).update({title,properties,updated_at:new Date().toISOString()}).eq('telegram_user_id',uid).eq('id',b.id));
      await must(db.from(tables.pages).update({title,updated_at:new Date().toISOString()}).eq('telegram_user_id',uid).eq('id',record.page_id));
      return json({ok:true,id:b.id,pageId:record.page_id});}
    const page=await must(db.from(tables.pages).insert({telegram_user_id:uid,title,icon:'🗂️'}).select('id').single());
    try{const record=await must(db.from(tables.records).insert({telegram_user_id:uid,source_id:b.sourceId,page_id:page.id,title,properties}).select('id').single());return json({ok:true,id:record.id,pageId:page.id});}
    catch(e){await db.from(tables.pages).delete().eq('id',page.id).eq('telegram_user_id',uid);throw e;}
  }
  if(act==='record_delete'){
    const record=validId(b.id)?await ownerRow(db,tables.records,uid,b.id):null;if(!record)return fail('Запись не найдена',404);
    await must(db.from(tables.pages).delete().eq('telegram_user_id',uid).eq('id',record.page_id));return json({ok:true});
  }
  if(act==='split_save'){
    const block=validId(b.blockId)?await ownerRow(db,tables.blocks,uid,b.blockId):null;if(!block||block.type!=='pipeline')return fail('Pipeline не найден',404);
    const title=safeText(b.title,120);if(!title)return fail('Название этапа обязательно');
    if(b.id){const row=validId(b.id)?await ownerRow(db,tables.splits,uid,b.id):null;if(!row||row.block_id!==b.blockId)return fail('Этап не найден',404);
      await must(db.from(tables.splits).update({title}).eq('telegram_user_id',uid).eq('id',b.id));return json({ok:true,id:b.id});}
    const pos=await position(db,tables.splits,uid,'block_id',b.blockId);
    const row=await must(db.from(tables.splits).insert({telegram_user_id:uid,block_id:b.blockId,title,position:pos}).select('id').single());return json({ok:true,id:row.id});
  }
  if(act==='split_delete'){
    const row=validId(b.id)?await ownerRow(db,tables.splits,uid,b.id):null;if(!row)return fail('Этап не найден',404);
    await must(db.from(tables.splits).delete().eq('telegram_user_id',uid).eq('id',b.id));return json({ok:true});
  }
  if(act==='split_reorder'){
    if(!validId(b.blockId))return fail('Неверный Pipeline');await setOrder(db,tables.splits,uid,'block_id',b.blockId,b.ids);return json({ok:true});
  }
  if(act==='workflow_save'){
    const split=validId(b.splitId)?await ownerRow(db,tables.splits,uid,b.splitId):null;if(!split)return fail('Этап не найден',404);
    if(b.id){const row=validId(b.id)?await ownerRow(db,tables.items,uid,b.id):null;if(!row||row.split_id!==b.splitId)return fail('Пункт не найден',404);
      const patch:Record<string,unknown>={updated_at:new Date().toISOString()};if(b.title!==undefined){const title=safeText(b.title,240);if(!title)return fail('Название обязательно');patch.title=title;}if(b.completed!==undefined)patch.completed=b.completed===true;
      await must(db.from(tables.items).update(patch).eq('telegram_user_id',uid).eq('id',b.id));return json({ok:true,id:b.id});}
    const title=safeText(b.title,240);if(!title)return fail('Название пункта обязательно');const pos=await position(db,tables.items,uid,'split_id',b.splitId);
    const row=await must(db.from(tables.items).insert({telegram_user_id:uid,split_id:b.splitId,title,completed:false,position:pos}).select('id').single());return json({ok:true,id:row.id});
  }
  if(act==='workflow_delete'){
    const row=validId(b.id)?await ownerRow(db,tables.items,uid,b.id):null;if(!row)return fail('Пункт не найден',404);
    await must(db.from(tables.items).delete().eq('telegram_user_id',uid).eq('id',b.id));return json({ok:true});
  }
  if(act==='workflow_reorder'){
    if(!validId(b.splitId))return fail('Неверный этап');await setOrder(db,tables.items,uid,'split_id',b.splitId,b.ids);return json({ok:true});
  }
  return fail('Неизвестная операция');
 }catch(err:any){console.error('os7:',err);return json({ok:false,error:err?.message?.slice(0,180)||'Ошибка сервера'},500);}
});